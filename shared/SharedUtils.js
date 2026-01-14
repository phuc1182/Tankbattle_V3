/**
 * SharedUtils.js
 * 
 * File này chứa các hàm utility dùng chung cho cả Client và Server
 * để đảm bảo logic nhất quán giữa 2 bên.
 * 
 * Quan trọng: Client-side Prediction
 * ===================================
 * Client cần dùng cùng hàm isColliding để kiểm tra va chạm với tường
 * TRƯỚC KHI gửi input lên server. Điều này tránh xe đi xuyên tường rồi
 * bị server giật lùi lại (rubber banding).
 * 
 * Sử dụng:
 * - Client: <script src="shared/SharedUtils.js"></script>
 * - Server: const SharedUtils = require('./shared/SharedUtils.js');
 */

/**
 * Kiểm tra va chạm giữa 2 hình chữ nhật (AABB - Axis-Aligned Bounding Box)
 * @param {Object} rect1 - {x, y, width, height}
 * @param {Object} rect2 - {x, y, width, height}
 * @returns {boolean} - true nếu 2 hình chữ nhật va chạm
 */
function isColliding(rect1, rect2) {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

/**
 * Kiểm tra va chạm với mảng các tường
 * @param {Object} rect - {x, y, width, height}
 * @param {Array} walls - Mảng các wall object
 * @returns {boolean} - true nếu rect va chạm với bất kỳ wall nào
 */
function isCollidingWithWalls(rect, walls) {
  for (let wall of walls) {
    if (isColliding(rect, wall)) {
      return true;
    }
  }
  return false;
}

/**
 * Tính khoảng cách giữa 2 điểm
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number} - Khoảng cách Euclidean
 */
function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Linear interpolation (Lerp)
 * @param {number} start - Giá trị bắt đầu
 * @param {number} end - Giá trị kết thúc
 * @param {number} factor - Hệ số lerp (0-1)
 * @returns {number} - Giá trị đã lerp
 */
function lerp(start, end, factor) {
  return start + (end - start) * factor;
}

/**
 * Clamp một giá trị trong khoảng [min, max]
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Kiểm tra xem một điểm có nằm trong hình chữ nhật không
 * @param {number} x 
 * @param {number} y 
 * @param {Object} rect - {x, y, width, height}
 * @returns {boolean}
 */
function pointInRect(x, y, rect) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

/**
 * Tính góc (radian) từ điểm (x1, y1) đến điểm (x2, y2)
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @returns {number} - Góc tính bằng radian
 */
function angleToPoint(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// ===========================
// Export cho cả Node.js và Browser
// ===========================
const SharedUtils = {
  isColliding,
  isCollidingWithWalls,
  distance,
  lerp,
  clamp,
  pointInRect,
  angleToPoint
};

// Export cho Node.js (server)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SharedUtils;
}

// Export cho Browser (client)
if (typeof window !== 'undefined') {
  window.SharedUtils = SharedUtils;
}
