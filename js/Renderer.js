// Renderer.js - Hàm vẽ
function renderPlayerScreen(ctx, canvas, targetTank, gameMap, bullets, tank1, tank2, items, particleSystem, playerData, turrets) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();

    // Camera theo targetTank
    let camX = targetTank.x - canvas.width / 2 + targetTank.width / 2;
    let camY = targetTank.y - canvas.height / 2 + targetTank.height / 2;
    camX = Math.max(0, Math.min(camX, gameMap.width - canvas.width));
    camY = Math.max(0, Math.min(camY, gameMap.height - canvas.height));
    ctx.translate(-camX, -camY);

    // Vẽ nền đất
    gameMap.drawBackground(ctx);
    
    // Vẽ Tường: Lấy tường trong viewport qua chunk index để tránh duyệt toàn bộ
    const viewRect = { x: camX, y: camY, width: canvas.width, height: canvas.height };
    const wallsInView = typeof gameMap.getWallsNearRect === 'function'
        ? gameMap.getWallsNearRect(viewRect, 0)
        : gameMap.walls;

    for (let i = 0; i < wallsInView.length; i++) {
        const wall = wallsInView[i];
        if (IMAGES.wall) {
            ctx.drawImage(IMAGES.wall, wall.x, wall.y, wall.width, wall.height);
        } else {
            ctx.fillStyle = "#8B4513";
            ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
            ctx.strokeStyle = "black";
            ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
        }
    }
    
    // Vẽ turrets (Static enemies)
    if (turrets && turrets.length > 0) {
        turrets.forEach(turret => {
            if (turret.x < camX + canvas.width && turret.x + turret.width > camX && 
                turret.y < camY + canvas.height && turret.y + turret.height > camY) {
                // Vẽ turret (hình vuông xám với HP bar)
                ctx.fillStyle = turret.health > 0 ? "#555555" : "#222222";
                ctx.fillRect(turret.x, turret.y, turret.width, turret.height);
                ctx.strokeStyle = "red";
                ctx.lineWidth = 2;
                ctx.strokeRect(turret.x, turret.y, turret.width, turret.height);
                
                // HP bar cho turret
                if (turret.health > 0) {
                    const hpPercent = turret.health / turret.maxHealth;
                    ctx.fillStyle = "black";
                    ctx.fillRect(turret.x, turret.y - 8, turret.width, 6);
                    ctx.fillStyle = hpPercent > 0.3 ? "green" : "red";
                    ctx.fillRect(turret.x, turret.y - 8, turret.width * hpPercent, 6);
                }
            }
        });
    }
    
    // Vẽ bullets - Chỉ vẽ trong viewport (tối ưu culling)
    bullets.forEach(b => {
        if (b.x > camX - 20 && b.x < camX + canvas.width + 20 &&
            b.y > camY - 20 && b.y < camY + canvas.height + 20) {
            b.draw(ctx); // Gọi method draw() của Bullet instance
        }
    });
    
    // Vẽ tank1 (mình - luôn hiển thị)
    if (tank1) {
        // Tank1 là mình, lấy data từ playerData
        const mySocketId = window.socket?.id;
        const tank1Data = mySocketId && playerData ? playerData[mySocketId] : null;
        
        if (tank1Data && tank1Data.isInvisible) {
            // Bản thân tàng hình: Vẽ bán trong suốt
            ctx.globalAlpha = 0.5;
            tank1.draw(ctx);
            ctx.globalAlpha = 1.0;
        } else {
            tank1.draw(ctx);
        }
        
        // Vẽ hiệu ứng burn (lửa) nếu có
        if (tank1Data && tank1Data.burnEffect) {
            ctx.fillStyle = "rgba(255, 100, 0, 0.6)";
            ctx.beginPath();
            ctx.arc(tank1.x + tank1.width / 2, tank1.y + tank1.height / 2, tank1.width / 2 + 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Vẽ tank2 (địch - có thể tàng hình)
    if (tank2) {
        // Tank2 là địch, tìm socket ID của địch
        const mySocketId = window.socket?.id;
        const enemySocketId = playerData ? Object.keys(playerData).find(sid => sid !== mySocketId) : null;
        const tank2Data = enemySocketId && playerData ? playerData[enemySocketId] : null;
        
        if (tank2Data && tank2Data.isInvisible) {
            // Địch tàng hình: Vẽ mờ 10% (bóng ma)
            ctx.globalAlpha = 0.1;
            tank2.draw(ctx);
            ctx.globalAlpha = 1.0;
        } else {
            tank2.draw(ctx);
        }
        
        // Vẽ hiệu ứng burn nếu có
        if (tank2Data && tank2Data.burnEffect) {
            ctx.fillStyle = "rgba(255, 100, 0, 0.6)";
            ctx.beginPath();
            ctx.arc(tank2.x + tank2.width / 2, tank2.y + tank2.height / 2, tank2.width / 2 + 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Vẽ viền map
    ctx.strokeStyle = "yellow"; ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, gameMap.width, gameMap.height);
    
    // Vẽ items (tối ưu: dùng forEach thay vì filter)
    items.forEach(item => {
        // Check visibility trực tiếp (item có width/height = 30)
        if (item.x < camX + canvas.width && item.x + 30 > camX && 
            item.y < camY + canvas.height && item.y + 30 > camY) {
            Item.drawRaw(ctx, item);
        }
    });

    // Vẽ particles
    particleSystem.draw(ctx);

    ctx.restore(); 

    // HUD - HP (tank1 là mình) - hiển thị số nguyên
    ctx.fillStyle = "black"; ctx.fillRect(10, 10, 104, 24); 
    const hpValue = targetTank ? Math.max(0, Math.round(targetTank.health)) : 0;
    let hpPercent = targetTank ? Math.max(0, targetTank.health / targetTank.maxHealth) : 0;
    ctx.fillStyle = hpPercent < 0.3 ? "red" : "#00ff00"; 
    ctx.fillRect(12, 12, 100 * hpPercent, 20);
    ctx.fillStyle = "white"; ctx.font = "bold 12px Arial";
    ctx.fillText(`HP: ${hpValue}`, 120, 27);
    
    // Debug info - bullet & particle count
    ctx.fillStyle = "white"; ctx.font = "12px Arial";
    ctx.fillText(`Bullets: ${bullets.length}`, 10, 60);
    ctx.fillText(`Particles: ${particleSystem ? particleSystem.particles.length : 0}`, 10, 80);

    // Buff timers (bên góc trái) - playerData là myPlayerData (data của tank1 - mình)
    if (playerData && playerData.buffTimers) {
        const timers = playerData.buffTimers;
        const entries = [
            { key: 'speed', label: '⚡ Tốc độ', color: '#FFD700' },
            { key: 'shield', label: '🛡️ Giáp', color: '#87CEEB' },
            { key: 'fireAmmo', label: '🔥 Đạn lửa', color: '#FF4500' },
            { key: 'clusterAmmo', label: '💥 Đạn chùm', color: '#9400D3' },
            { key: 'stealth', label: '👻 Tàng hình', color: '#808080' }
        ];
        
        const buffBarWidth = 150;
        const buffBarHeight = 16;
        const buffStartX = 10;
        const buffStartY = 100;
        const buffSpacing = 22;
        
        let line = 0;
        ctx.font = "bold 12px Arial";
        entries.forEach(entry => {
            const val = timers[entry.key];
            if (val && val > 0) {
                // Map key to BUFF_DURATION key
                let durationKey = entry.key.toUpperCase();
                if (entry.key === 'fireAmmo') durationKey = 'FIRE_AMMO';
                else if (entry.key === 'clusterAmmo') durationKey = 'CLUSTER_AMMO';
                
                const maxDuration = SharedConstants.BUFF_DURATION[durationKey] || 600;
                const percent = Math.min(100, (val / maxDuration) * 100);
                const sec = Math.ceil(val / 60);
                
                const x = buffStartX;
                const y = buffStartY + line * buffSpacing;
                
                // Vẽ background của thanh
                ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
                ctx.fillRect(x, y, buffBarWidth, buffBarHeight);
                ctx.strokeStyle = entry.color;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, buffBarWidth, buffBarHeight);
                
                // Vẽ thanh tiến trình
                ctx.fillStyle = entry.color;
                ctx.fillRect(x + 1, y + 1, (buffBarWidth - 2) * (percent / 100), buffBarHeight - 2);
                
                // Vẽ text (tên hiệu ứng + số giây còn lại)
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 11px Arial";
                ctx.textAlign = "left";
                ctx.fillText(`${entry.label} - ${sec}s`, x + 5, y + 12);
                
                line++;
            }
        });
        
        // Burn effect timer
        if (playerData.burnEffect) {
            const sec = Math.ceil(playerData.burnEffect.duration / 60);
            const burnMaxDuration = SharedConstants.BUFF_VALUES.FIRE_DOT_DURATION;
            const burnPercent = Math.min(100, (playerData.burnEffect.duration / burnMaxDuration) * 100);
            
            const x = buffStartX;
            const y = buffStartY + line * buffSpacing;
            
            // Vẽ background của thanh
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.fillRect(x, y, buffBarWidth, buffBarHeight);
            ctx.strokeStyle = "#FF6347";
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, buffBarWidth, buffBarHeight);
            
            // Vẽ thanh tiến trình (màu đỏ cam)
            ctx.fillStyle = "#FF6347";
            ctx.fillRect(x + 1, y + 1, (buffBarWidth - 2) * (burnPercent / 100), buffBarHeight - 2);
            
            // Vẽ text (tên hiệu ứng + số giây còn lại)
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px Arial";
            ctx.textAlign = "left";
            ctx.fillText(`🔥 Cháy - ${sec}s`, x + 5, y + 12);
        }
        
        ctx.textAlign = "left";
    }

    // Vẽ item pickup notifications
    if (window.itemNotifications && window.itemNotifications.length > 0) {
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        window.itemNotifications.forEach((notif, index) => {
            const alpha = notif.time < 30 ? 1 : (1 - (notif.time - 30) / 150);
            ctx.fillStyle = `rgba(0, 255, 100, ${alpha})`;
            ctx.fillText(notif.text, window.canvas.width / 2, 50 + index * 30);
        });
        ctx.textAlign = "left";
    }
}

// Global
window.renderPlayerScreen = renderPlayerScreen;

// === MINI-MAP RENDERING ===
function renderMiniMap(minimapCanvas, gameMap, targetTank, players, turrets, items) {
    if (!minimapCanvas) return;
    
    const ctx = minimapCanvas.getContext('2d');
    const mapW = gameMap.width;
    const mapH = gameMap.height;
    const scale = minimapCanvas.width / mapW; // 200 / 2400 = 1/12
    
    // Clear mini-map
    ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Vẽ background
    ctx.fillStyle = "rgba(50, 50, 50, 0.8)";
    ctx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Vẽ viền
    ctx.strokeStyle = "#ffc107";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    
    // Vẽ turrets (chấm xám)
    if (turrets) {
        turrets.forEach(turret => {
            if (turret.health > 0) {
                const x = turret.x * scale + turret.width * scale / 2;
                const y = turret.y * scale + turret.height * scale / 2;
                ctx.fillStyle = "#888888";
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    
    // Vẽ items (chấm vàng nhỏ)
    if (items && items.length > 0) {
        items.forEach(item => {
            const x = item.x * scale + 15 * scale;
            const y = item.y * scale + 15 * scale;
            ctx.fillStyle = "rgba(255, 215, 0, 0.6)";
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    // Vẽ players
    if (players) {
        Object.entries(players).forEach(([socketId, player]) => {
            if (player.health <= 0) return;
            
            const x = player.x * scale + player.width * scale / 2;
            const y = player.y * scale + player.height * scale / 2;
            
            // Check tàng hình
            if (player.isInvisible && socketId !== window.socket?.id) {
                // Địch tàng hình: Không hiển thị trên mini-map
                return;
            }
            
            // Dùng player.id để hiển thị đúng: p1 xanh, p2 đỏ
            if (player.id === 'p1') {
                ctx.fillStyle = "#00ff00"; // Xanh = P1
            } else {
                ctx.fillStyle = "#ff0000"; // Đỏ = P2
            }
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Vẽ viền để nổi bật
            ctx.strokeStyle = "white";
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }
}

window.renderMiniMap = renderMiniMap;