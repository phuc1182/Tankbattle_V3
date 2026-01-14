// Renderer.js - Hàm vẽ
function renderPlayerScreen(ctx, canvas, targetTank, gameMap, bullets, tank1, tank2, items, particleSystem, playerData) {
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
    
    // Vẽ Tường (tối ưu: dùng forEach thay vì filter để tránh tạo mảng mới)
    // Chỉ vẽ tường nằm trong viewport
    gameMap.walls.forEach(wall => {
        // Check visibility trực tiếp trong vòng lặp (nhanh hơn .filter)
        if (wall.x < camX + canvas.width && wall.x + wall.width > camX && 
            wall.y < camY + canvas.height && wall.y + wall.height > camY) {
            if (IMAGES.wall) {
                ctx.drawImage(IMAGES.wall, wall.x, wall.y, wall.width, wall.height);
            } else {
                ctx.fillStyle = "#8B4513";
                ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
                ctx.strokeStyle = "black";
                ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
            }
        }
    });
    
    // Vẽ bullets - Chỉ vẽ trong viewport (tối ưu culling)
    bullets.forEach(b => {
        if (b.x > camX - 20 && b.x < camX + canvas.width + 20 &&
            b.y > camY - 20 && b.y < camY + canvas.height + 20) {
            b.draw(ctx); // Gọi method draw() của Bullet instance
        }
    });
    if (tank1) tank1.draw(ctx);
    if (tank2) tank2.draw(ctx);

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

    // HUD - HP
    ctx.fillStyle = "black"; ctx.fillRect(10, 10, 104, 24); 
    let hpPercent = targetTank ? Math.max(0, targetTank.health / targetTank.maxHealth) : 0;
    ctx.fillStyle = hpPercent < 0.3 ? "red" : "#00ff00"; 
    ctx.fillRect(12, 12, 100 * hpPercent, 20);
    ctx.fillStyle = "white"; ctx.font = "bold 12px Arial";
    ctx.fillText(`HP: ${targetTank ? targetTank.health : 0}`, 120, 27);
    
    // Debug info - bullet & particle count
    ctx.fillStyle = "white"; ctx.font = "12px Arial";
    ctx.fillText(`Bullets: ${bullets.length}`, 10, 60);
    ctx.fillText(`Particles: ${particleSystem ? particleSystem.particles.length : 0}`, 10, 80);

    // Buff timers (bên góc trái)
    if (playerData && playerData.buffTimers) {
        const timers = playerData.buffTimers;
        const entries = [
            { key: 'speed', label: 'Tốc độ' },
            { key: 'shield', label: 'Giáp' },
            { key: 'damage', label: 'Sát thương' },
            { key: 'piercing', label: 'Xuyên tường' },
            { key: 'explosive', label: 'Đạn nổ' }
        ];
        let line = 0;
        ctx.font = "12px Arial";
        entries.forEach(entry => {
            const val = timers[entry.key];
            if (val && val > 0) {
                const sec = Math.ceil(val / 60);
                ctx.fillStyle = "white";
                ctx.fillText(`${entry.label}: ${sec}s`, 10, 100 + line * 16);
                line++;
            }
        });
    }
}

// Global
window.renderPlayerScreen = renderPlayerScreen;