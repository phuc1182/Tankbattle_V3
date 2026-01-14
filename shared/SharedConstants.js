/**
 * SharedConstants.js
 * 
 * File này chứa tất cả các hằng số dùng chung cho cả Client và Server
 * để đảm bảo đồng bộ giữa 2 bên và dễ dàng điều chỉnh gameplay.
 * 
 * Sử dụng:
 * - Client: <script src="shared/SharedConstants.js"></script>
 * - Server: const SharedConstants = require('./shared/SharedConstants.js');
 */

// ===========================
// MAP CONSTANTS
// ===========================
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 1200;
const TILE_SIZE = 50;  // Kích thước ô map (tương ứng với ảnh wall.png)
const CHUNK_SIZE = 200; // Kích thước chunk để tối ưu collision detection

// ===========================
// TANK CONSTANTS
// ===========================
const TANK_WIDTH = 46;
const TANK_HEIGHT = 46;
const TANK_BASE_SPEED = 2.5;
const TANK_HITBOX_PADDING = 8; // Thu nhỏ hitbox để đi qua khe hẹp dễ hơn

// ===========================
// BULLET CONSTANTS
// ===========================
const BULLET_WIDTH = 10;
const BULLET_HEIGHT = 10;
const BULLET_SPEED = 12.5; // 5x tốc độ xe tăng
const BULLET_DAMAGE_BASE = 10;
const BULLET_BARREL_LENGTH = 35; // Khoảng cách spawn đạn từ tâm xe
const SHOOT_COOLDOWN = 200; // ms giữa mỗi lần bắn

// ===========================
// PLAYER CONSTANTS
// ===========================
const PLAYER_MAX_HEALTH = 100;
const PLAYER_BASE_DAMAGE = 10;
const PLAYER_BASE_SHIELD = 0;

// Vị trí spawn mặc định
const PLAYER_P1_SPAWN = { x: 175, y: 175 };
const PLAYER_P2_SPAWN_OFFSET = { x: 225, y: 225 }; // Tính từ góc dưới-phải map

// ===========================
// ITEM CONSTANTS
// ===========================
const ITEM_SIZE = 30;
const ITEM_SPAWN_INTERVAL = 120; // frames (2 seconds tại 60fps)
const ITEM_MAX_PER_ROOM = 30; // Giới hạn số item spawn

// Số lượng target cho mỗi loại item (6 types)
const ITEM_TARGETS = {
  HEALTH: 4,      // type 1
  SPEED: 4,       // type 2
  SHIELD: 4,      // type 3
  DAMAGE: 4,      // type 4
  PIERCING: 3,    // type 5
  EXPLOSIVE: 3    // type 6
};

// Thời gian buff (frames tại 60fps)
const BUFF_DURATION = {
  SPEED: 600,      // 10 seconds
  SHIELD: 900,     // 15 seconds
  DAMAGE: 600,     // 10 seconds
  PIERCING: 720,   // 12 seconds
  EXPLOSIVE: 720   // 12 seconds
};

// Giá trị buff
const BUFF_VALUES = {
  HEALTH_RESTORE: 30,
  SPEED_BOOST: 1.5,   // Thêm vào base speed
  SHIELD_VALUE: 10,   // Giảm damage nhận vào
  DAMAGE_BOOST: 15,   // Thêm vào base damage
  EXPLOSIVE_BONUS: 5  // Thêm damage cho explosive bullet
};

// ===========================
// MAP GENERATION CONSTANTS
// ===========================
const MAP_OBSTACLE_DENSITY = 0.10; // 10% chance để spawn obstacle
const MAP_SAFE_ZONE_SIZE = 7; // 7x7 tiles safe zone ở 2 góc

// ===========================
// NETWORK CONSTANTS
// ===========================
const PHYSICS_UPDATE_RATE = 60; // Hz (16ms per frame)
const NETWORK_UPDATE_RATE = 30; // Hz (33ms per frame)
const INPUT_THROTTLE_RATE = 30; // Hz (33ms) - giới hạn gửi input

// Interpolation settings
const LERP_FACTOR = 0.5; // Độ mượt khi lerp vị trí (0-1)
const SNAP_THRESHOLD = 50; // pixels - Nếu lệch > 50px thì snap thay vì lerp

// View distance (Minecraft-like optimization)
const VIEW_PADDING_X = 800;
const VIEW_PADDING_Y = 600;

// ===========================
// ROOM CONSTANTS
// ===========================
const MAX_BULLETS_PER_ROOM = 30;
const MAX_PLAYERS_PER_ROOM = 2;

// ===========================
// Export cho cả Node.js và Browser
// ===========================
const SharedConstants = {
  // Map
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
  CHUNK_SIZE,
  
  // Tank
  TANK_WIDTH,
  TANK_HEIGHT,
  TANK_BASE_SPEED,
  TANK_HITBOX_PADDING,
  
  // Bullet
  BULLET_WIDTH,
  BULLET_HEIGHT,
  BULLET_SPEED,
  BULLET_DAMAGE_BASE,
  BULLET_BARREL_LENGTH,
  SHOOT_COOLDOWN,
  
  // Player
  PLAYER_MAX_HEALTH,
  PLAYER_BASE_DAMAGE,
  PLAYER_BASE_SHIELD,
  PLAYER_P1_SPAWN,
  PLAYER_P2_SPAWN_OFFSET,
  
  // Items
  ITEM_SIZE,
  ITEM_SPAWN_INTERVAL,
  ITEM_MAX_PER_ROOM,
  ITEM_TARGETS,
  BUFF_DURATION,
  BUFF_VALUES,
  
  // Map Generation
  MAP_OBSTACLE_DENSITY,
  MAP_SAFE_ZONE_SIZE,
  
  // Network
  PHYSICS_UPDATE_RATE,
  NETWORK_UPDATE_RATE,
  INPUT_THROTTLE_RATE,
  LERP_FACTOR,
  SNAP_THRESHOLD,
  VIEW_PADDING_X,
  VIEW_PADDING_Y,
  
  // Room
  MAX_BULLETS_PER_ROOM,
  MAX_PLAYERS_PER_ROOM
};

// Export cho Node.js (server)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SharedConstants;
}

// Export cho Browser (client)
if (typeof window !== 'undefined') {
  window.SharedConstants = SharedConstants;
}
