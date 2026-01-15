// js/Map.js - Phiên bản ĐẦY ĐỦ (Dùng ảnh nền + ảnh tường)

class GameMap {
    constructor(mapWidth, mapHeight, tileSize) {
        this.width = mapWidth;
        this.height = mapHeight;
        this.tileSize = tileSize;
        this.walls = []; // Sẽ được server điền dữ liệu vào sau
        this.chunkSize = SharedConstants?.CHUNK_SIZE || 200;
        this.wallChunks = new Map();
        // Đã xóa this.generateMap() vì map do server tạo
    }

    // Xây index tường theo chunk để truy vấn nhanh (giống server)
    buildWallChunks() {
        const chunkSize = this.chunkSize;
        const chunks = new Map();
        const getKey = (cx, cy) => `${cx},${cy}`;
        const toChunk = (x, y) => ({ cx: Math.floor(x / chunkSize), cy: Math.floor(y / chunkSize) });

        this.walls.forEach(wall => {
            const { cx, cy } = toChunk(wall.x, wall.y);
            const key = getKey(cx, cy);
            if (!chunks.has(key)) chunks.set(key, []);
            chunks.get(key).push(wall);
        });

        this.wallChunks = chunks;
    }

    // Lấy tường gần một hình chữ nhật (dùng cho collision client)
    getWallsNearRect(rect, pad = 10) {
        const chunkSize = this.chunkSize;
        if (!this.wallChunks || this.wallChunks.size === 0) return this.walls || [];

        const startCx = Math.floor(Math.max(0, rect.x - pad) / chunkSize);
        const endCx = Math.floor(Math.min(this.width, rect.x + rect.width + pad) / chunkSize);
        const startCy = Math.floor(Math.max(0, rect.y - pad) / chunkSize);
        const endCy = Math.floor(Math.min(this.height, rect.y + rect.height + pad) / chunkSize);

        const walls = [];
        for (let cy = startCy; cy <= endCy; cy++) {
            for (let cx = startCx; cx <= endCx; cx++) {
                const key = `${cx},${cy}`;
                const arr = this.wallChunks.get(key);
                if (arr) walls.push(...arr);
            }
        }
        return walls;
    }

    // --- HÀM VẼ MỚI (DÙNG ẢNH) ---

    // 1. Vẽ nền đất (Lát gạch background)
    drawBackground(ctx) {
        // Kiểm tra xem ảnh đã tải xong chưa (biến IMAGES bên main.js)
        if (typeof IMAGES !== 'undefined' && IMAGES.bg) {
            // Tạo mẫu pattern từ ảnh để lặp lại (giống lát gạch sàn nhà)
            const pattern = ctx.createPattern(IMAGES.bg, 'repeat');
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, this.width, this.height);
        } else {
            // Dự phòng: Nếu chưa có ảnh thì vẽ màu xám
            ctx.fillStyle = "#555";
            ctx.fillRect(0, 0, this.width, this.height);
        }
    }
}