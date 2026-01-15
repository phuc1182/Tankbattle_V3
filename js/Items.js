class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 1: Health, 2: Speed, 3: Shield, 4: Fire Ammo, 5: Cluster Ammo, 6: Stealth
        this.width = 30;
        this.height = 30;
    }

    // Static method để vẽ item từ raw data (tối ưu bộ nhớ)
    static drawRaw(ctx, item) {
        const width = 30;
        const height = 30;
        ctx.save();
        
        if (item.type === 1) {
            // Heal
            ctx.fillStyle = "#00ff00";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("H", item.x + 8, item.y + 22);
        } else if (item.type === 2) {
            // Speed
            ctx.fillStyle = "yellow";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "black"; ctx.font = "bold 20px Arial";
            ctx.fillText("S", item.x + 8, item.y + 22);
        } else if (item.type === 3) {
            // Shield
            ctx.fillStyle = "#808080";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("G", item.x + 8, item.y + 22);
        } else if (item.type === 4) {
            // Fire Ammo (Cam đỏ - 🔥)
            ctx.fillStyle = "#ff4500";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("🔥", item.x + 5, item.y + 22);
        } else if (item.type === 5) {
            // Cluster Ammo (Tím - 💥)
            ctx.fillStyle = "#9400d3";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("💥", item.x + 5, item.y + 22);
        } else if (item.type === 6) {
            // Stealth (Đen - 👻)
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("👻", item.x + 5, item.y + 22);
        }
        
        // Vẽ viền sáng
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x, item.y, width, height);
        
        ctx.restore();
    }

    draw(ctx) {
        // Sử dụng drawRaw để giữ nhất quán  
        Item.drawRaw(ctx, this);
    }
}