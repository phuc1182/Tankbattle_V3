class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 1: Heal, 2: Speed, 3: Shield, 4: Damage, 5: Piercing, 6: Explosive
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
            // Damage boost
            ctx.fillStyle = "#ff0000";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("D", item.x + 8, item.y + 22);
        } else if (item.type === 5) {
            // Piercing bullets
            ctx.fillStyle = "#800080";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("P", item.x + 8, item.y + 22);
        } else if (item.type === 6) {
            // Explosive bullets
            ctx.fillStyle = "#000000";
            ctx.fillRect(item.x, item.y, width, height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("E", item.x + 8, item.y + 22);
        }
        
        // Vẽ viền sáng
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(item.x, item.y, width, height);
        
        ctx.restore();
    }

    draw(ctx) {
        // Nếu bạn có ảnh thì thay bằng drawImage, ở đây tôi dùng màu để dễ test
        ctx.save();
        
        if (this.type === 1) {
            // Heal
            ctx.fillStyle = "#00ff00";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("H", this.x + 8, this.y + 22);
        } else if (this.type === 2) {
            // Speed
            ctx.fillStyle = "yellow";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = "black"; ctx.font = "bold 20px Arial";
            ctx.fillText("S", this.x + 8, this.y + 22);
        } else if (this.type === 3) {
            // Shield
            ctx.fillStyle = "#808080";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("G", this.x + 8, this.y + 22);
        } else if (this.type === 4) {
            // Damage boost
            ctx.fillStyle = "#ff0000";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("D", this.x + 8, this.y + 22);
        } else if (this.type === 5) {
            // Piercing bullets
            ctx.fillStyle = "#800080";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("P", this.x + 8, this.y + 22);
        } else if (this.type === 6) {
            // Explosive bullets
            ctx.fillStyle = "#000000";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = "white"; ctx.font = "bold 20px Arial";
            ctx.fillText("E", this.x + 8, this.y + 22);
        }
        
        // Vẽ viền sáng
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        ctx.restore();
    }
}