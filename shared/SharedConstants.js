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
const MAP_WIDTH = 2400;   // Tăng gấp đôi (2400x2400)
const MAP_HEIGHT = 2400;
const TILE_SIZE = 50;  // Kích thước ô map (tương ứng với ảnh wall.png)
const CHUNK_SIZE = 400; // Tăng chunk size để tối ưu với map lớn

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
const BULLET_DAMAGE_BASE = 20;  // Tăng từ 10 -> 20
const BULLET_BARREL_LENGTH = 35; // Khoảng cách spawn đạn từ tâm xe
const SHOOT_COOLDOWN = 200; // ms giữa mỗi lần bắn

// ===========================
// PLAYER CONSTANTS
// ===========================
const PLAYER_MAX_HEALTH = 200;  // Tăng từ 100 -> 200
const PLAYER_BASE_DAMAGE = 20;  // Tăng từ 10 -> 20
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

// Số lượng target cho mỗi loại item (Đã cập nhật: 6 types mới)
const ITEM_TARGETS = {
  HEALTH: 4,        // type 1 - Giữ lại
  SPEED: 4,         // type 2 - Giữ lại
  SHIELD: 4,        // type 3 - Giữ lại
  FIRE_AMMO: 3,     // type 4 - Mới: Đạn lửa
  CLUSTER_AMMO: 3,  // type 5 - Mới: Đạn chùm
  STEALTH: 2        // type 6 - Mới: Tàng hình
};

// Thời gian buff (frames tại 60fps)
const BUFF_DURATION = {
  SPEED: 600,        // 10 seconds
  SHIELD: 900,       // 15 seconds
  FIRE_AMMO: 720,    // 12 seconds
  CLUSTER_AMMO: 720, // 12 seconds
  STEALTH: 600       // 10 seconds
};

// Giá trị buff
const BUFF_VALUES = {
  HEALTH_RESTORE: 30,
  SPEED_BOOST: 1.5,       // Thêm vào base speed
  SHIELD_VALUE: 10,       // Giảm damage nhận vào
  FIRE_DOT_DAMAGE: 5 / 60, // 5 HP mỗi giây -> ~0.0833 per tick tại 60fps
  FIRE_DOT_DURATION: 180,  // 3 giây (60fps)
  CLUSTER_FRAG_COUNT: 6,  // Số đạn con khi nổ
  CLUSTER_FRAG_DAMAGE: 10 // Damage của đạn con
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
const SNAP_THRESHOLD = 150; // Tang t? 50 cho map l?n 2400x2400 // pixels - Nếu lệch > 50px thì snap thay vì lerp

// View distance (Minecraft-like optimization)
const VIEW_PADDING_X = 800;
const VIEW_PADDING_Y = 600;

// ===========================
// ROOM CONSTANTS
// ===========================
const MAX_BULLETS_PER_ROOM = 30;
const MAX_PLAYERS_PER_ROOM = 2;

// ===========================
// TURRET CONSTANTS (MỚI)
// ===========================
const TURRET_MAX_HEALTH = 300;
const TURRET_DAMAGE = 15;
const TURRET_RANGE = 400;       // Tầm bắn (pixels)
const TURRET_SHOOT_COOLDOWN = 1200; // 20 frames = ~2 giây (chậm lại)
const TURRET_SIZE = 40;         // Kích thước vẽ turret
const TURRET_COUNT = 8;         // Số lượng turret trên map

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
  MAX_PLAYERS_PER_ROOM,
  
  // Turret (Mới)
  TURRET_MAX_HEALTH,
  TURRET_DAMAGE,
  TURRET_RANGE,
  TURRET_SHOOT_COOLDOWN,
  TURRET_SIZE,
  TURRET_COUNT
};

// Export cho Node.js (server)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SharedConstants;
}

// Export cho Browser (client)
if (typeof window !== 'undefined') {
  window.SharedConstants = SharedConstants;
}
