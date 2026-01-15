// Game.js - Logic game chính (multiplayer)
let gameMap, tank1, tank2;
let bullets = []; // Mảng Bullet objects với client-side prediction
let bulletMap = new Map(); // Map id -> Bullet instance
window.bulletMap = bulletMap; // Expose globally cho Tank.js
let items = [];
let turrets = []; // Turrets từ server
let particleSystem;
let isGameOver = false;
let isRenderLoopRunning = false;
let itemNotifications = []; // Lưu notifications khi nhặt item

// DOM elements
const gameOverLayer = document.getElementById('game-over-layer');
const winnerText = document.getElementById('winner-text');
const homeBtn = document.getElementById('homeBtn');

function initGame() {
    // Reset state mỗi lần nhận gameState (ví dụ restart)
    bullets = [];
    bulletMap = new Map();
    window.bulletMap = bulletMap;
    items = [];
    turrets = [];
    isGameOver = false;

    // Tạo Map từ server
    gameMap = new GameMap(window.gameState.map.width, window.gameState.map.height, SharedConstants.TILE_SIZE);
    gameMap.walls = window.gameState.map.walls;
    // Xây chunk index cho tường để collision client không duyệt toàn bộ
    if (gameMap.walls && gameMap.walls.length > 0) {
        gameMap.buildWallChunks();
    }

    // Tìm player của socket hiện tại trong gameState
    const myPlayerId = Object.keys(window.gameState.players).find(socketId => socketId === window.socket.id);
    const myPlayerData = myPlayerId ? window.gameState.players[myPlayerId] : null;
    const isP1 = myPlayerData && myPlayerData.id === 'p1';
    
    // Tạo tanks instances với màu dựa trên socketId
    // Socket của mình luôn dùng tank1 (màu xanh), socket kia dùng tank2 (màu đỏ)
    tank1 = new Tank(0, 0, "tank1", isP1 ? "p1" : "p2");
    tank2 = new Tank(0, 0, "tank2", isP1 ? "p2" : "p1");

    // Reset input state khi (re)join
    tank1.resetInput();
    tank2.resetInput();

    // Setup controls cho tank1 (tank của mình)
    tank1.setupControls();

    // Tạo hệ thống hạt
    particleSystem = new ParticleSystem();
    window.particleSystem = particleSystem;

    // Items từ server
    items = window.gameState.items;

    // Phát nhạc nền
    if (window.audioManager) {
        window.audioManager.playMusic('sounds/bgmusic.mp3');
    }

    // Start rendering (chỉ khởi động một lần)
    if (!isRenderLoopRunning) {
        isRenderLoopRunning = true;
        window.renderGame();
    }
}

// Hàm render game (thay cho gameLoop)
function renderGame() {
    if (!window.gameState) return;

    // Update local state
    const oldItems = items || [];
    items = window.gameState.items; // Sử dụng raw data từ server
    turrets = window.gameState.turrets || []; // Lấy turrets từ server

    // Client-side bullet prediction: Sync với server và tự update
    const oldBulletIds = new Set(bulletMap.keys());
    const serverBullets = window.gameState.bullets;
    const currentBulletIds = new Set();

    // Update hoặc tạo bullets từ server
    serverBullets.forEach(serverBullet => {
        currentBulletIds.add(serverBullet.id);
        if (bulletMap.has(serverBullet.id)) {
            // Đã có - update từ server
            bulletMap.get(serverBullet.id).updateFromServer(serverBullet);
        } else {
            // Mới - tạo Bullet instance
            bulletMap.set(serverBullet.id, new Bullet(serverBullet));
        }
    });

    // Xóa bullets không còn trên server
    const removedBulletIds = [];
    oldBulletIds.forEach(id => {
        if (!currentBulletIds.has(id)) {
            const bullet = bulletMap.get(id);
            if (bullet) removedBulletIds.push(bullet);
            bulletMap.delete(id);
        }
    });

    // Client-side prediction: Tự update vị trí bullets mỗi frame
    bulletMap.forEach(bullet => bullet.update());
    bullets = Array.from(bulletMap.values());

    const players = Object.values(window.gameState.players);
    
    // Tìm data của mình và đối phương
    const mySocketId = window.socket.id;
    const myPlayerData = window.gameState.players[mySocketId];
    const enemyPlayerData = players.find(p => Object.keys(window.gameState.players).find(sid => window.gameState.players[sid] === p) !== mySocketId);
    
    // Tank1 là mình, Tank2 là địch
    if (myPlayerData) {
        tank1.updateFromData(myPlayerData);
        tank1.update(); // Lerp vị trí để chuyển động mượt mà
        // Tạo bụi khi xe di chuyển (phía sau xe)
        if (particleSystem && (myPlayerData.keys?.up || myPlayerData.keys?.down || myPlayerData.keys?.left || myPlayerData.keys?.right)) {
            if (Math.random() < 0.3) { // 30% chance mỗi frame
                // Tính vị trí bụi phía sau xe (ngược hướng đi)
                const dustX = myPlayerData.x + myPlayerData.width/2 - myPlayerData.lastDx * 20;
                const dustY = myPlayerData.y + myPlayerData.height/2 - myPlayerData.lastDy * 20;
                particleSystem.createDust(dustX, dustY, 1);
            }
        }
    }
    if (enemyPlayerData) {
        tank2.updateFromData(enemyPlayerData);
        tank2.updateSimple(); // Dùng lerp đơn giản, không prediction
        // Tạo bụi khi xe di chuyển (phía sau xe)
        if (particleSystem && (enemyPlayerData.keys?.up || enemyPlayerData.keys?.down || enemyPlayerData.keys?.left || enemyPlayerData.keys?.right)) {
            if (Math.random() < 0.3) {
                const dustX = enemyPlayerData.x + enemyPlayerData.width/2 - enemyPlayerData.lastDx * 20;
                const dustY = enemyPlayerData.y + enemyPlayerData.height/2 - enemyPlayerData.lastDy * 20;
                particleSystem.createDust(dustX, dustY, 1);
            }
        }
    }

    // Không phát âm thanh khi đạn đang bay, chỉ phát khi nhấn bắn (xử lý ở Tank.setupControls)

    // Phát hiện đạn bị xóa (va chạm tường/người) để tạo hiệu ứng nổ
    if (particleSystem && removedBulletIds.length > 0) {
        removedBulletIds.forEach(bullet => {
            const inMap = bullet.x >= 0 && bullet.x <= window.gameState.map.width && 
                          bullet.y >= 0 && bullet.y <= window.gameState.map.height;
            if (inMap) {
                const color = bullet.type === 2 ? 'red' : bullet.type === 3 ? 'yellow' : 'orange';
                particleSystem.createExplosion(bullet.x, bullet.y, 8, color, 25, 3);
            }
        });
    }

    isGameOver = window.gameState.isGameOver;

    if (isGameOver && window.gameState.winner) {
        endGame(window.gameState.winner);
        return; // Dừng render loop
    }

    // targetTank luôn là tank1 (mình)
    const targetTank = tank1;

    // Phát hiện item bị nhặt gần mình (tránh trigger khi item ra khỏi viewport)
    if (oldItems.length > 0 && items.length <= oldItems.length) {
        let pickedNearMe = false;
        const tol = 2;
        const radius = 80;
        if (targetTank) {
            oldItems.forEach(oi => {
                const stillExists = items.some(ni => ni.type === oi.type && Math.abs(ni.x - oi.x) < tol && Math.abs(ni.y - oi.y) < tol);
                if (!stillExists) {
                    const dx = (oi.x + 15) - (targetTank.x + targetTank.width / 2);
                    const dy = (oi.y + 15) - (targetTank.y + targetTank.height / 2);
                    if (Math.hypot(dx, dy) < radius) {
                        pickedNearMe = true;
                        // Thêm notification cho item được nhặt
                        const itemNames = {
                            1: 'Phục hồi HP',
                            2: 'Tốc độ',
                            3: 'Giáp bảo vệ',
                            4: 'Đạn lửa',
                            5: 'Đạn chùm',
                            6: 'Tàng hình'
                        };
                        const durations = {
                            1: 0,
                            2: 10,
                            3: 15,
                            4: 10,
                            5: 10,
                            6: 15
                        };
                        itemNotifications.push({
                            text: `+${itemNames[oi.type]}${durations[oi.type] > 0 ? ' (' + durations[oi.type] + 's)' : ''}`,
                            time: 0,
                            duration: 180 // 3 giây ở 60fps
                        });
                    }
                }
            });
        }
        if (pickedNearMe && window.audioManager) window.audioManager.playSound('pickup');
    }

    // Update particle system
    if (particleSystem) {
        particleSystem.update();
    }

    // Render main screen
    window.renderPlayerScreen(window.ctx, window.canvas, targetTank, gameMap, bullets, tank1, tank2, items, particleSystem, myPlayerData, turrets);
    
    // Render mini-map
    const minimapCanvas = document.getElementById('minimap');
    if (minimapCanvas && targetTank) {
        window.renderMiniMap(minimapCanvas, gameMap, targetTank, players, turrets, items);
    }

    // Update item notifications
    itemNotifications.forEach(notif => {
        notif.time++;
    });
    itemNotifications = itemNotifications.filter(notif => notif.time < notif.duration);

    requestAnimationFrame(renderGame);
}

// Hàm gọi khi có người hết máu
function endGame(winnerId) {
    // Chỉ hiển thị game over 1 lần
    if (gameOverLayer.style.display === 'flex') return;
    
    isGameOver = true;
    // Cho phép render loop khởi động lại khi restart
    isRenderLoopRunning = false;
    
    // Dừng nhạc nền
    if (window.audioManager) window.audioManager.stopMusic();
    
    // Hiện bảng thông báo
    gameOverLayer.style.display = 'flex';
    winnerText.innerText = winnerId.toUpperCase() + " CHIẾN THẮNG!";
    
    // Đổi màu chữ
    if (winnerId === "p1") {
        winnerText.style.color = "#3498db";
    } else {
        winnerText.style.color = "#e74c3c";
    }
    
    // Tự động rời phòng và reload sau 3 giây
    setTimeout(() => {
        if (window.socket && window.roomId) {
            window.socket.emit('leaveRoom', { roomId: window.roomId });
        }
        location.reload();
    }, 3000);
    
    console.log('Game Over! Winner:', winnerId);
}

// Global
window.initGame = initGame;
window.renderGame = renderGame;
window.endGame = endGame;
window.gameMap = gameMap;
window.tank1 = tank1;
window.tank2 = tank2;
window.bullets = bullets;
window.items = items;
window.particleSystem = particleSystem;
window.isGameOver = isGameOver;