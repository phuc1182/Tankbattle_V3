// js/Map.js - Phiên bản ĐẦY ĐỦ (Dùng ảnh nền + ảnh tường)

class GameMap {
    constructor(mapWidth, mapHeight, tileSize) {
        this.width = mapWidth;
        this.height = mapHeight;
        this.tileSize = tileSize;
        this.walls = []; // Sẽ được server điền dữ liệu vào sau
        // Đã xóa this.generateMap() vì map do server tạo
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