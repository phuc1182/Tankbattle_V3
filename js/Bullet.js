class Bullet {
    // Client-side bullet wrapper cho prediction
    constructor(serverData) {
        this.id = serverData.id;
        // Vị trí hiện tại (client tự tính)
        this.x = serverData.x;
        this.y = serverData.y;
        // Vị trí từ server (để sync)
        this.serverX = serverData.x;
        this.serverY = serverData.y;
        this.dx = serverData.dx;
        this.dy = serverData.dy;
        this.speed = serverData.speed || SharedConstants.BULLET_SPEED; // Lấy từ SharedConstants
        this.type = serverData.type;
        this.lastUpdateTime = Date.now();
        this.synced = false; // Đánh dấu đã nhận sync đầu tiên chưa
    }

    // Update từ server data
    updateFromServer(serverData) {
        this.serverX = serverData.x;
        this.serverY = serverData.y;
        this.dx = serverData.dx;
        this.dy = serverData.dy;
        this.type = serverData.type;

        // Với đạn: chỉ snap khi tạo lần đầu hoặc lệch lớn, tránh lerp làm chậm đạn
        const dist = SharedUtils.distance(this.x, this.y, this.serverX, this.serverY);
        if (!this.synced || dist > 60) {
            // Snap cứng nếu lệch lớn hoặc lần đầu
            this.x = this.serverX;
            this.y = this.serverY;
            this.synced = true;
        } else if (dist > 5) {
            // Lerp mạnh nếu lệch vừa
            const correctionFactor = 0.85;
            this.x += (this.serverX - this.x) * correctionFactor;
            this.y += (this.serverY - this.y) * correctionFactor;
        }
        // Nếu lệch nhỏ (<5px) giữ nguyên để tránh jitter
        this.lastUpdateTime = Date.now();
    }

    // Client-side prediction: tự tính vị trí mỗi frame
    update() {
        this.x += this.dx * this.speed;
        this.y += this.dy * this.speed;
    }

    draw(ctx) {
        const image = IMAGES.bullet;
        if (image) {
            ctx.drawImage(image, this.x - 8, this.y - 8, 16, 16);
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
            if (this.type === 1) ctx.fillStyle = "orange";
            else if (this.type === 2) ctx.fillStyle = "red";
            else if (this.type === 3) ctx.fillStyle = "yellow";
            ctx.fill();
            ctx.closePath();
        }
    }

    // Static method để vẽ raw data từ server (backward compatibility)
    static drawRaw(ctx, bulletData) {
        const image = IMAGES.bullet;
        if (image) {
            ctx.drawImage(image, bulletData.x - 8, bulletData.y - 8, 16, 16);
        } else {
            ctx.beginPath();
            ctx.arc(bulletData.x, bulletData.y, 5, 0, Math.PI * 2);
            if (bulletData.type === 1) ctx.fillStyle = "orange";
            else if (bulletData.type === 2) ctx.fillStyle = "red";
            else if (bulletData.type === 3) ctx.fillStyle = "yellow";
            ctx.fill();
            ctx.closePath();
        }
    }
}