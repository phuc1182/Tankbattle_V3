# ✅ ITEM TESTING CHECKLIST

## Các Item và Cách Test

### 1. **Health (Xanh lá - H)** ✅
- **Hiệu ứng**: Hồi 30 HP
- **Cách test**: 
  1. Để địch bắn mất máu
  2. Nhặt item Health
  3. Kiểm tra HP bar tăng lên
- **Trạng thái**: ✅ Đã hoạt động (logic cũ giữ lại)

---

### 2. **Speed (Vàng - S)** ✅
- **Hiệu ứng**: +1.5 tốc độ trong 10 giây
- **Cách test**:
  1. Nhặt item Speed
  2. Di chuyển xe sẽ thấy nhanh hơn
  3. Kiểm tra timer "Tốc độ: Xs" ở góc trái
  4. Sau 10s tốc độ trở về bình thường
- **Trạng thái**: ✅ Đã hoạt động (logic cũ giữ lại)

---

### 3. **Shield (Xám - G)** ✅
- **Hiệu ứng**: Giáp 10 (giảm damage nhận vào) trong 15 giây
- **Cách test**:
  1. Nhặt item Shield
  2. Kiểm tra timer "Giáp: Xs"
  3. Để địch bắn, damage giảm 10 mỗi phát
- **Trạng thái**: ✅ Đã hoạt động (logic cũ giữ lại)

---

### 4. **Fire Ammo (Cam đỏ - 🔥)** ⚠️ CẦN TEST
- **Hiệu ứng**: 
  - Đạn gây **burn effect** (DOT)
  - Target bị cháy mất 3 HP/tick trong 3 giây
  - Icon 🔥 hiển thị trên target
- **Cách test**:
  1. Nhặt item Fire Ammo (màu cam đỏ)
  2. Kiểm tra timer "Đạn lửa: Xs"
  3. Bắn trúng địch
  4. Địch sẽ có:
     - Halo cam quanh xe
     - Timer "🔥 Đang cháy: Xs"
     - HP giảm dần theo thời gian
- **Code files**: 
  - Server: `server.js` (line ~485 - bullet collision)
  - Client: `Renderer.js` (line ~95 - burn effect visual)

---

### 5. **Cluster Ammo (Tím - 💥)** ⚠️ CẦN TEST
- **Hiệu ứng**:
  - Đạn nổ thành **6 đạn con** theo 360°
  - Mỗi đạn con gây 10 damage
  - Kích hoạt khi: Chạm tường/player/turret
- **Cách test**:
  1. Nhặt item Cluster Ammo (màu tím)
  2. Kiểm tra timer "Đạn chùm: Xs"
  3. Bắn về tường hoặc địch
  4. Xem đạn **NỔ** ra 6 viên bay tứ tung
  5. Đạn con biến mất sau ~0.5 giây
- **Code files**:
  - Server: `server.js` (function `createClusterFragments`)
  - Visual: Đạn con có size nhỏ hơn (0.7x)

---

### 6. **Stealth (Đen - 👻)** ⚠️ CẦN TEST
- **Hiệu ứng**:
  - Tàng hình 10 giây
  - Địch thấy bạn mờ 10% (gần như ẩn)
  - Bản thân thấy mình mờ 50%
  - **MẤT** khi bắn súng
  - Không hiện trên mini-map
- **Cách test**:
  1. Nhặt item Stealth (màu đen)
  2. Kiểm tra timer "Tàng hình: Xs"
  3. Xe của bạn sẽ mờ 50% (bạn vẫn thấy)
  4. Địch chỉ thấy bóng mờ 10%
  5. Kiểm tra mini-map: Chấm của bạn biến mất
  6. Bắn 1 phát -> Mất tàng hình ngay lập tức
- **Code files**:
  - Server: `server.js` (stealth logic, shoot removes invisibility)
  - Client: `Renderer.js` (line ~78-106 - opacity rendering)
  - Mini-map: `Renderer.js` (line ~234 - skip invisible enemies)

---

## 🔧 ĐÃ FIX

### ✅ Fix 1: Thêm hàm `createClusterFragments`
**Location**: [server.js](server/server.js#L127-L155)
```javascript
function createClusterFragments(game, bullet) {
  const fragmentCount = 6;
  const fragmentDamage = 10;
  const angleStep = (Math.PI * 2) / fragmentCount;
  
  for (let i = 0; i < fragmentCount; i++) {
    const angle = angleStep * i;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    
    game.bullets.push({
      id: game.bulletSeq++,
      x: bullet.x,
      y: bullet.y,
      dx, dy,
      speed: SharedConstants.BULLET_SPEED * 0.6,
      ownerId: bullet.ownerId,
      damage: fragmentDamage,
      type: 1,
      isFragment: true,
      lifespan: 30 // ~0.5s
    });
  }
}
```

### ✅ Fix 2: Cập nhật Items.js với icon mới
**Location**: [js/Items.js](js/Items.js)
- Fire Ammo: Icon 🔥, màu #ff4500
- Cluster Ammo: Icon 💥, màu #9400d3
- Stealth: Icon 👻, màu #1a1a1a

---

## 🧪 HƯỚNG DẪN TEST

### Bước 1: Khởi động server
```bash
cd server
npm start
```

### Bước 2: Mở 2 trình duyệt
- Browser 1: `http://localhost:3000`
- Browser 2: `http://localhost:3000`

### Bước 3: Test từng item
1. Player 1 tạo phòng
2. Player 2 tham gia
3. Bắt đầu game
4. Đợi items spawn (mỗi 2 giây)
5. Nhặt từng loại item và test theo checklist ở trên

---

## 📊 KẾT QUẢ TEST

| Item | Spawn OK | Pickup OK | Effect OK | Visual OK | Timer OK | Notes |
|------|----------|-----------|-----------|-----------|----------|-------|
| Health | ✅ | ✅ | ✅ | ✅ | N/A | Logic cũ |
| Speed | ✅ | ✅ | ✅ | ✅ | ✅ | Logic cũ |
| Shield | ✅ | ✅ | ✅ | ✅ | ✅ | Logic cũ |
| Fire Ammo | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Cần test |
| Cluster | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Cần test |
| Stealth | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Cần test |

---

## 🐛 LỖI CÓ THỂ GẶP

### Lỗi 1: Items không spawn
- **Nguyên nhân**: Server chưa khởi động hoặc chưa đủ 2 người chơi
- **Fix**: Đảm bảo game đã start và đợi 2 giây

### Lỗi 2: Cluster không nổ
- **Nguyên nhân**: Thiếu hàm `createClusterFragments`
- **Fix**: Đã thêm ở commit này ✅

### Lỗi 3: Stealth vẫn thấy rõ
- **Nguyên nhân**: Renderer không check `isInvisible`
- **Fix**: Đã cập nhật Renderer.js ✅

### Lỗi 4: Burn effect không hiển thị
- **Nguyên nhân**: Thiếu playerData trong renderPlayerScreen
- **Fix**: Đã truyền playerData vào render ✅

---

## 📝 GHI CHÚ

- Tất cả item spawning đã được cấu hình trong `SharedConstants.js`
- Server logic xử lý trong `server.js` (physics loop)
- Client rendering trong `Renderer.js` và `Items.js`
- Buff timers tự động giảm mỗi frame (60fps)
