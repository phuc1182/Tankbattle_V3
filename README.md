# Tank Battle Multiplayer

Game bắn xe tăng multiplayer online với hệ thống phòng chơi.

## Cách chơi

1. Cài Node.js (https://nodejs.org).

2. Chạy server:
   ```
   cd server
   npm install
   npm start
   ```

3. Mở browser, truy cập http://localhost:3000.

4. **Người chơi 1**: Click "TẠO PHÒNG MỚI" → Sẽ nhận được Room ID (vd: room_abc123).

5. **Người chơi 2**: Nhập Room ID vào ô input → Click "THAM GIA PHÒNG".

6. Khi đủ 2 người, người tạo phòng (host) nhấn "BẮT ĐẦU TRẬN ĐẤU".

7. Người chơi cuối cùng còn sống là người chiến thắng!

## Controls
- WASD: Di chuyển
- Space: Bắn

## Tính năng
- Tạo phòng tự động với Room ID
- Hàng chờ người chơi
- Host có quyền bắt đầu trận đấu
- Hệ thống buff items (tốc độ, giáp, sát thương...)
- Nhiều loại đạn (thường, xuyên tường, nổ)
- Client-side prediction cho gameplay mượt mà
- Optimized network (30fps updates, 60fps physics)

## Lưu ý
- Server chạy trên port 3000
- Game sync qua WebSockets
- Mỗi phòng hỗ trợ 2 players
- Phòng tự động xóa khi rỗng hoặc host rời