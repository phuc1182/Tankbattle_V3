class Tank {
    constructor(x, y, imageKey, id) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = SharedConstants.TANK_WIDTH;
        this.height = SharedConstants.TANK_HEIGHT;
        
        // Interpolation (Lerp) cho chuyển động mượt mà
        this.targetX = x; // Vị trí đích từ server
        this.targetY = y;
        this.lerpFactor = SharedConstants.LERP_FACTOR; // Tốc độ lerp từ SharedConstants
        
        this.image = IMAGES[imageKey]; 
        
        this.maxHealth = SharedConstants.PLAYER_MAX_HEALTH;
        this.health = SharedConstants.PLAYER_MAX_HEALTH;
        this.shield = SharedConstants.PLAYER_BASE_SHIELD;
        this.damage = SharedConstants.PLAYER_BASE_DAMAGE;
        this.bulletType = 1;
        
        this.lastDx = 0; 
        this.lastDy = -1;

        this.keys = { up: false, down: false, left: false, right: false, shoot: false };
        this.canShoot = true;
        this.controlsSetup = false; // Flag để chỉ setup 1 lần
        
        // Input throttling để tránh spam socket.emit cho movement
        this.lastInputSendTime = 0;
        this.inputSendInterval = 1000 / SharedConstants.INPUT_THROTTLE_RATE; // ms từ SharedConstants
        
        // Movement priority: Track thứ tự phím nhấn để xử lý multi-key input tốt hơn
        this.movementPriority = []; // Array chứa các phím movement đang được nhấn theo thứ tự
        this.lastSentPriority = []; // Track priority đã gửi lên server
        
        // === CLIENT-SIDE PREDICTION ===
        // Vị trí predicted (client tự tính, không chờ server)
        this.predictedX = x;
        this.predictedY = y;
        
        // Vị trí cuối cùng nhận từ server (để reconcile)
        this.lastServerX = x;
        this.lastServerY = y;
        
        // Queue input chưa được reconcile từ server
        this.pendingInputs = []; // [{dx, dy, timestamp, seq}, ...]
        this.inputSequenceNumber = 0; // Sequence number cho mỗi input
        
        // Threshold để detect lệch quá xa (reconciliation)
        this.reconciliationThreshold = SharedConstants.SNAP_THRESHOLD; // Dùng lại SNAP_THRESHOLD
    }

    resetInput() {
        this.keys = { up: false, down: false, left: false, right: false, shoot: false };
        this.canShoot = true;
    }

  setupControls() {
    // Chỉ setup 1 lần, tránh lặp listeners
    if (this.controlsSetup) return;
    this.controlsSetup = true;
    
    // Lấy controls từ settings của session hiện tại hoặc dùng mặc định
    const controls = window.controlsP1 || { up: 'w', down: 's', left: 'a', right: 'd', shoot: ' ' };
    
    window.addEventListener('keydown', (e) => {
        const oldKeys = JSON.stringify(this.keys);
        const wasShoot = this.keys.shoot;
        
        // Movement keys với priority tracking
        if (e.key === controls.up && !this.keys.up) {
            this.keys.up = true;
            // Xóa 'up' khỏi array nếu có (tránh duplicate), rồi thêm vào cuối
            this.movementPriority = this.movementPriority.filter(k => k !== 'up');
            this.movementPriority.push('up');
        }
        if (e.key === controls.down && !this.keys.down) {
            this.keys.down = true;
            this.movementPriority = this.movementPriority.filter(k => k !== 'down');
            this.movementPriority.push('down');
        }
        if (e.key === controls.left && !this.keys.left) {
            this.keys.left = true;
            this.movementPriority = this.movementPriority.filter(k => k !== 'left');
            this.movementPriority.push('left');
        }
        if (e.key === controls.right && !this.keys.right) {
            this.keys.right = true;
            this.movementPriority = this.movementPriority.filter(k => k !== 'right');
            this.movementPriority.push('right');
        }
        
        if (e.key === controls.shoot) {
            this.keys.shoot = true;
            // === AUDIO OVERLAPPING ===
            // allowOverlap = true để cho tiếng súng chồng lên nhau (clone method)
            if (!wasShoot && window.audioManager) window.audioManager.playSound('shoot', false, true);
        }
        
        const now = Date.now();
        const priorityChanged = JSON.stringify(this.movementPriority) !== JSON.stringify(this.lastSentPriority || []);
        
        if ((JSON.stringify(this.keys) !== oldKeys || priorityChanged) && window.socket) {
            // === CLIENT-SIDE PREDICTION: Apply movement ngay ===
            // Nếu có thay đổi movement priority, predict + apply ngay
            if (priorityChanged) {
                const { dx, dy } = this.predictMovement(this.movementPriority);
                if (dx !== 0 || dy !== 0) {
                    this.applyPredictedMovement(dx, dy, SharedConstants.TANK_BASE_SPEED);
                    this.lastDx = dx;
                    this.lastDy = dy;
                }
            }
            
            // Gửi keys kèm priority array
            const input = { ...this.keys, priority: this.movementPriority };
            
            // Shoot key hoặc priority thay đổi: gửi ngay lập tức
            if (e.key === controls.shoot || priorityChanged) {
                window.socket.emit('playerInput', { roomId: window.roomId || 'default', input });
                this.lastInputSendTime = now;
                this.lastSentPriority = [...this.movementPriority]; // Lưu priority đã gửi
            }
            // Movement keys khác: throttle 33ms
            else if (now - this.lastInputSendTime >= this.inputSendInterval) {
                window.socket.emit('playerInput', { roomId: window.roomId || 'default', input });
                this.lastInputSendTime = now;
                this.lastSentPriority = [...this.movementPriority];
            }
        }
    });
    window.addEventListener('keyup', (e) => {
        const oldKeys = JSON.stringify(this.keys);
        
        // Movement keys với priority tracking
        if (e.key === controls.up) {
            this.keys.up = false;
            this.movementPriority = this.movementPriority.filter(k => k !== 'up');
        }
        if (e.key === controls.down) {
            this.keys.down = false;
            this.movementPriority = this.movementPriority.filter(k => k !== 'down');
        }
        if (e.key === controls.left) {
            this.keys.left = false;
            this.movementPriority = this.movementPriority.filter(k => k !== 'left');
        }
        if (e.key === controls.right) {
            this.keys.right = false;
            this.movementPriority = this.movementPriority.filter(k => k !== 'right');
        }
        
        if (e.key === controls.shoot) {
            this.keys.shoot = false;
            this.canShoot = true;
        }
        
        const now = Date.now();
        const priorityChanged = JSON.stringify(this.movementPriority) !== JSON.stringify(this.lastSentPriority || []);
        
        if ((JSON.stringify(this.keys) !== oldKeys || priorityChanged) && window.socket) {
            // === CLIENT-SIDE PREDICTION: Apply movement ngay khi nhả phím ===
            if (priorityChanged) {
                const { dx, dy } = this.predictMovement(this.movementPriority);
                if (dx !== 0 || dy !== 0) {
                    this.applyPredictedMovement(dx, dy, SharedConstants.TANK_BASE_SPEED);
                    this.lastDx = dx;
                    this.lastDy = dy;
                } else {
                    // Nếu không có phím di chuyển nữa, giữ hướng cuối
                    // (lastDx, lastDy vẫn là hướng trước đó)
                }
            }
            
            // Gửi keys kèm priority array
            const input = { ...this.keys, priority: this.movementPriority };
            
            // Shoot key release hoặc priority thay đổi: gửi ngay
            if (e.key === controls.shoot || priorityChanged) {
                window.socket.emit('playerInput', { roomId: window.roomId || 'default', input });
                this.lastInputSendTime = now;
                this.lastSentPriority = [...this.movementPriority];
            }
            // Movement keys khác: throttle 33ms
            else if (now - this.lastInputSendTime >= this.inputSendInterval) {
                window.socket.emit('playerInput', { roomId: window.roomId || 'default', input });
                this.lastInputSendTime = now;
                this.lastSentPriority = [...this.movementPriority];
            }
        }
    });
  }

    // Update from server data
    updateFromData(data) {
        // Thay vì gán cứng tọa độ (this.x = data.x), ta lưu vào targetX/targetY
        // Sau đó trong update() sẽ lerp từ vị trí hiện tại đến target
        this.targetX = data.x;
        this.targetY = data.y;
        
        // === RECONCILIATION: Kiểm tra lệch giữa predicted và server ===
        // Nếu predicted tương đối chính xác (lệch < threshold), keep using predicted
        // Nếu lệch > threshold, reconcile (reset về server state + replay inputs)
        const predictionError = SharedUtils.distance(this.predictedX, this.predictedY, data.x, data.y);
        
        if (predictionError > this.reconciliationThreshold) {
            // Lệch quá xa: Reconcile
            console.warn(`[Reconciliation] Error: ${predictionError.toFixed(1)}px, resetting...`);
            
            // Reset về server state
            this.predictedX = data.x;
            this.predictedY = data.y;
            this.lastServerX = data.x;
            this.lastServerY = data.y;
            
            // Xóa pending inputs vì server đã process rồi
            this.pendingInputs = [];
        } else {
            // Lệch nhỏ: Keep using predicted, chỉ update lastServerX/Y để reference
            this.lastServerX = data.x;
            this.lastServerY = data.y;
        }
        
        // Các thuộc tính khác vẫn cập nhật ngay lập tức
        this.health = data.health;
        this.shield = data.shield;
        this.damage = data.damage;
        this.bulletType = data.bulletType;
        this.lastDx = data.lastDx;
        this.lastDy = data.lastDy;
    }
    
    // === CLIENT-SIDE PREDICTION ===
    // Hàm này được gọi trong setupControls để predict movement
    predictMovement(priority) {
        let dx = 0, dy = 0;
        
        // Xử lý priority thứ tự phím (từ mới nhất)
        if (priority.length > 0) {
            let verticalSet = false;
            let horizontalSet = false;
            
            for (let i = priority.length - 1; i >= 0; i--) {
                const key = priority[i];
                
                if (!verticalSet) {
                    if (key === 'up') { dy = -1; verticalSet = true; }
                    else if (key === 'down') { dy = 1; verticalSet = true; }
                }
                
                if (!horizontalSet) {
                    if (key === 'left') { dx = -1; horizontalSet = true; }
                    else if (key === 'right') { dx = 1; horizontalSet = true; }
                }
                
                if (verticalSet && horizontalSet) break;
            }
        }
        
        return { dx, dy };
    }
    
    // Apply predicted movement ngay lập tức
    applyPredictedMovement(dx, dy, speed = SharedConstants.TANK_BASE_SPEED) {
        if (dx === 0 && dy === 0) return;
        
        // Nếu gameMap chưa khởi tạo, tạm thời bỏ qua collision check
        if (typeof gameMap === 'undefined') {
            this.predictedX += dx * speed;
            this.predictedY += dy * speed;
            return;
        }
        
        // Tính vị trí mới
        let newX = this.predictedX + dx * speed;
        let newY = this.predictedY + dy * speed;
        
        // Boundary check
        newX = Math.max(0, Math.min(newX, gameMap.width - this.width));
        newY = Math.max(0, Math.min(newY, gameMap.height - this.height));
        
        // Collision check với tường
        const testHitbox = {
            x: newX + SharedConstants.TANK_HITBOX_PADDING,
            y: newY + SharedConstants.TANK_HITBOX_PADDING,
            width: this.width - SharedConstants.TANK_HITBOX_PADDING * 2,
            height: this.height - SharedConstants.TANK_HITBOX_PADDING * 2
        };
        
        // Kiểm tra va chạm với tường gần đó
        const nearbyWalls = gameMap.walls ? gameMap.walls.filter(wall => 
            Math.abs(wall.x - newX) < 150 && Math.abs(wall.y - newY) < 150
        ) : [];
        
        let hasCollision = false;
        for (let wall of nearbyWalls) {
            if (SharedUtils.isColliding(testHitbox, wall)) {
                hasCollision = true;
                break;
            }
        }
        
        // Nếu không va chạm, update predicted position
        if (!hasCollision) {
            this.predictedX = newX;
            this.predictedY = newY;
        }
        
        // Lưu input vào pending queue để reconcile sau
        this.pendingInputs.push({
            seq: this.inputSequenceNumber++,
            dx: dx,
            dy: dy,
            speed: speed,
            timestamp: Date.now()
        });
    }

    // Hàm lerp để interpolate vị trí mỗi frame với Snap Logic
    update() {
        // === CONTINUOUS CLIENT-SIDE PREDICTION (Mỗi Frame) ===
        // Nếu có phím di chuyển được nhấn, predict liên tục
        const { dx, dy } = this.predictMovement(this.movementPriority);
        if (dx !== 0 || dy !== 0) {
            this.applyPredictedMovement(dx, dy, SharedConstants.TANK_BASE_SPEED);
            this.lastDx = dx;
            this.lastDy = dy;
        }
        
        // === DISPLAY: Dùng PREDICTED position thay vì SERVER position ===
        // Điều này làm xe di chuyển ngay lập tức theo client prediction
        // this.x và this.y là position dùng để vẽ
        
        // Lerp giữa predicted position và target position (từ server)
        // Nếu predicted khá chính xác thì lerp sẽ rất nhỏ
        const distanceToTarget = SharedUtils.distance(this.predictedX, this.predictedY, this.targetX, this.targetY);
        
        if (distanceToTarget > this.reconciliationThreshold) {
            // Lệch quá xa: Snap cứng
            this.predictedX = this.targetX;
            this.predictedY = this.targetY;
        } else {
            // Lệch nhỏ: Lerp mượt mà
            this.predictedX += (this.targetX - this.predictedX) * this.lerpFactor;
            this.predictedY += (this.targetY - this.predictedY) * this.lerpFactor;
            
            if (Math.abs(this.targetX - this.predictedX) < 0.5) this.predictedX = this.targetX;
            if (Math.abs(this.targetY - this.predictedY) < 0.5) this.predictedY = this.targetY;
        }
        
        // Gán predicted position vào display position
        this.x = this.predictedX;
        this.y = this.predictedY;
    }

    draw(ctx) {
        // Tính toán góc quay (Angle)
        // Math.atan2 trả về góc tính bằng radian
        let angle = Math.atan2(this.lastDy, this.lastDx);
        
        // Điều chỉnh góc: Vì ảnh mặc định hướng lên (UP), 
        // nhưng atan2 tính góc 0 là bên phải (RIGHT).
        // Ta cần cộng thêm 90 độ (PI/2) để khớp.
        angle += Math.PI / 2;

        ctx.save();
        
        // Dịch chuyển gốc tọa độ về TÂM của xe tăng
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        
        // Xoay
        ctx.rotate(angle);

        // Vẽ ảnh (Lùi về -width/2, -height/2 để vẽ đúng tâm)
        if (this.image) {
            ctx.drawImage(this.image, -this.width / 2, -this.height / 2, this.width, this.height);
        } else {
            // Dự phòng nếu ảnh lỗi thì vẽ hình vuông
            ctx.fillStyle = this.id === "p1" ? "red" : "blue";
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        }

        ctx.restore();
    }
}