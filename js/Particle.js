class Particle {
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x;
        this.y = y;
        this.vx = vx; // Tốc độ X
        this.vy = vy; // Tốc độ Y
        this.color = color;
        this.life = life; // Thời gian sống (frames)
        this.maxLife = life;
        this.size = size || 3; // Kích thước hạt
        this.opacity = 1; // Độ trong suốt
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.opacity = this.life / this.maxLife; // Giảm dần opacity
        // Có thể thêm lực hấp dẫn hoặc giảm tốc độ nếu muốn
        this.vx *= 0.98; // Giảm tốc độ dần
        this.vy *= 0.98;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = 50; // Giới hạn 50 particles để tối ưu
    }

    addParticle(x, y, vx, vy, color, life, size) {
        if (this.particles.length < this.maxParticles) {
            this.particles.push(new Particle(x, y, vx, vy, color, life, size));
        }
    }

    // Tạo hiệu ứng nổ (nhiều hạt bay ra ngẫu nhiên)
    createExplosion(x, y, count = 5, color = 'orange', life = 30, speed = 2) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const vx = Math.cos(angle) * speed * (Math.random() * 0.5 + 0.5);
            const vy = Math.sin(angle) * speed * (Math.random() * 0.5 + 0.5);
            this.addParticle(x, y, vx, vy, color, life, Math.random() * 3 + 1);
        }
    }

    // Tạo hiệu ứng bụi (ít hạt hơn, màu nâu)
    createDust(x, y, count = 2, color = '#8B4513', life = 20, speed = 1) {
        for (let i = 0; i < count; i++) {
            const vx = (Math.random() - 0.5) * speed;
            const vy = (Math.random() - 0.5) * speed - 0.5; // Bay lên một chút
            this.addParticle(x, y, vx, vy, color, life, Math.random() * 2 + 1);
        }
    }

    update() {
        this.particles = this.particles.filter(p => {
            p.update();
            return !p.isDead();
        });
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}