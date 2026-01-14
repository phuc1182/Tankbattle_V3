// Game.js - Logic game chính (multiplayer)
let gameMap, tank1, tank2;
let bullets = []; // Mảng Bullet objects với client-side prediction
let bulletMap = new Map(); // Map id -> Bullet instance
window.bulletMap = bulletMap; // Expose globally cho Tank.js
let items = [];
let particleSystem;
let isGameOver = false;

// DOM elements
const gameOverLayer = document.getElementById('game-over-layer');
const winnerText = document.getElementById('winner-text');
const restartBtn = document.getElementById('restartBtn');
const homeBtn = document.getElementById('homeBtn');

function initGame() {
    // Tạo Map từ server
    gameMap = new GameMap(window.gameState.map.width, window.gameState.map.height, SharedConstants.TILE_SIZE);
    gameMap.walls = window.gameState.map.walls;

    // Tạo tanks instances
    tank1 = new Tank(0, 0, "tank1", "p1");
    tank2 = new Tank(0, 0, "tank2", "p2");

    // Reset input state khi (re)join
    tank1.resetInput();
    tank2.resetInput();

    // Setup controls chỉ cho tank của player hiện tại
    if (window.isP1) {
        tank1.setupControls();
    } else {
        tank2.setupControls();
    }

    // Tạo hệ thống hạt
    particleSystem = new ParticleSystem();
    window.particleSystem = particleSystem;

    // Items từ server
    items = window.gameState.items;

    // Phát nhạc nền
    if (window.audioManager) {
        window.audioManager.playMusic('sounds/bgmusic.mp3');
    }

    // Start rendering
    window.renderGame();
}

// Hàm render game (thay cho gameLoop)
function renderGame() {
    if (!window.gameState) return;

    // Update local state
    const oldItems = items || [];
    items = window.gameState.items; // Sử dụng raw data từ server

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
    const p1Data = players.find(p => p.id === 'p1');
    const p2Data = players.find(p => p.id === 'p2');
    if (p1Data) {
        tank1.updateFromData(p1Data);
        tank1.update(); // Lerp vị trí để chuyển động mượt mà
        // Tạo bụi khi xe di chuyển (phía sau xe)
        if (particleSystem && (p1Data.keys?.up || p1Data.keys?.down || p1Data.keys?.left || p1Data.keys?.right)) {
            if (Math.random() < 0.3) { // 30% chance mỗi frame
                // Tính vị trí bụi phía sau xe (ngược hướng đi)
                const dustX = p1Data.x + p1Data.width/2 - p1Data.lastDx * 20;
                const dustY = p1Data.y + p1Data.height/2 - p1Data.lastDy * 20;
                particleSystem.createDust(dustX, dustY, 1);
            }
        }
    }
    if (p2Data) {
        tank2.updateFromData(p2Data);
        tank2.update(); // Lerp vị trí để chuyển động mượt mà
        // Tạo bụi khi xe di chuyển (phía sau xe)
        if (particleSystem && (p2Data.keys?.up || p2Data.keys?.down || p2Data.keys?.left || p2Data.keys?.right)) {
            if (Math.random() < 0.3) {
                const dustX = p2Data.x + p2Data.width/2 - p2Data.lastDx * 20;
                const dustY = p2Data.y + p2Data.height/2 - p2Data.lastDy * 20;
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

    // Chọn targetTank và dữ liệu người chơi hiện tại
    const targetTank = window.isP1 ? tank1 : tank2;
    const myPlayerData = window.isP1 ? p1Data : p2Data;

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

    // Render
    window.renderPlayerScreen(window.ctx, window.canvas, targetTank, gameMap, bullets, tank1, tank2, items, particleSystem, myPlayerData);

    requestAnimationFrame(renderGame);
}

// Hàm gọi khi có người hết máu
function endGame(winnerId) {
    // Chỉ hiển thị game over 1 lần
    if (gameOverLayer.style.display === 'flex') return;
    
    isGameOver = true;
    
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