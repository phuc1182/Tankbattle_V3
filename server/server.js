const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import shared constants and utils
const SharedConstants = require('../shared/SharedConstants.js');
const SharedUtils = require('../shared/SharedUtils.js');

// Thời gian miễn sát thương sau khi bắt đầu ván (frames @60fps)
const SPAWN_PROTECTION_FRAMES = 180; // 3 giây

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" },
  pingInterval: 10000,    // Ping every 10s
  pingTimeout: 30000,     // Wait 30s for pong before disconnect
  maxHttpBufferSize: 1e6  // 1MB buffer
});

const PORT = process.env.PORT || 3000;

// Serve static files (client)
app.use(express.static(path.join(__dirname, '..')));

// Game state per room
let games = new Map(); // roomId -> game state

// Copy map generation from Map.js (simplified)
function generateMap() {
  const walls = [];
  const mapWidth = SharedConstants.MAP_WIDTH;
  const mapHeight = SharedConstants.MAP_HEIGHT;
  const tileSize = SharedConstants.TILE_SIZE;
  const chunkSize = SharedConstants.CHUNK_SIZE; // Chunk 200x200 to reduce collision checks
  const cols = mapWidth / tileSize;
  const rows = mapHeight / tileSize;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let isBorder = (row === 0 || row === rows - 1 || col === 0 || col === cols - 1);
      let isObstacle = Math.random() < SharedConstants.MAP_OBSTACLE_DENSITY;
      let safeZoneP1 = (col < SharedConstants.MAP_SAFE_ZONE_SIZE && row < SharedConstants.MAP_SAFE_ZONE_SIZE);
      let safeZoneP2 = (col > cols - (SharedConstants.MAP_SAFE_ZONE_SIZE + 1) && row > rows - (SharedConstants.MAP_SAFE_ZONE_SIZE + 1));

      if (isBorder || (isObstacle && !safeZoneP1 && !safeZoneP2)) {
        walls.push({
          x: col * tileSize,
          y: row * tileSize,
          width: tileSize,
          height: tileSize
        });
      }
    }
  }
  const map = { width: mapWidth, height: mapHeight, walls, tileSize, chunkSize };
  buildWallChunks(map);
  return map;
}

// Build a chunk index for walls to speed up collision checks
function buildWallChunks(map) {
  const chunks = new Map();
  const getKey = (cx, cy) => `${cx},${cy}`;
  const toChunk = (x, y) => ({ cx: Math.floor(x / map.chunkSize), cy: Math.floor(y / map.chunkSize) });
  for (let wall of map.walls) {
    const { cx, cy } = toChunk(wall.x, wall.y);
    const key = getKey(cx, cy);
    if (!chunks.has(key)) chunks.set(key, []);
    chunks.get(key).push(wall);
  }
  map.wallChunks = chunks;
}

// Generate turrets (Static AI enemies)
function generateTurrets(map) {
  const turrets = [];
  const count = SharedConstants.TURRET_COUNT;
  const mapW = map.width;
  const mapH = map.height;
  const tileSize = SharedConstants.TILE_SIZE;
  const safeTiles = SharedConstants.MAP_SAFE_ZONE_SIZE;
  const safeSize = safeTiles * tileSize;
  const margin = 50; // thêm khoảng cách để tránh sát mép spawn

  // Safe zones quanh spawn người chơi (tránh đặt turret ở đây)
  const safeZones = [
    { x: 0, y: 0, width: safeSize + margin, height: safeSize + margin }, // Góc trên trái (P1)
    { x: mapW - (safeSize + margin), y: mapH - (safeSize + margin), width: safeSize + margin, height: safeSize + margin } // Góc dưới phải (P2)
  ];

  const isInSafeZone = (x, y, size) => {
    const rect = { x, y, width: size, height: size };
    return safeZones.some(zone => SharedUtils.isColliding(rect, zone));
  };
  
  // Chia map thành 4 zones, mỗi zone có 2 turrets
  const zones = [
    { x: 0, y: 0, w: mapW / 2, h: mapH / 2 },           // Top-left
    { x: mapW / 2, y: 0, w: mapW / 2, h: mapH / 2 },    // Top-right
    { x: 0, y: mapH / 2, w: mapW / 2, h: mapH / 2 },    // Bottom-left
    { x: mapW / 2, y: mapH / 2, w: mapW / 2, h: mapH / 2 } // Bottom-right
  ];
  
  let turretId = 0;
  for (let zone of zones) {
    // Spawn 2 turrets mỗi zone
    for (let i = 0; i < 2; i++) {
      let x, y, attempts = 0;
      do {
        x = zone.x + Math.random() * zone.w;
        y = zone.y + Math.random() * zone.h;
        attempts++;
      } while (
        attempts < 50 && (
          isInSafeZone(x, y, SharedConstants.TURRET_SIZE) ||
          map.walls.some(wall =>
            SharedUtils.isColliding(
              { x, y, width: SharedConstants.TURRET_SIZE, height: SharedConstants.TURRET_SIZE },
              wall
            )
          )
        )
      );
      
      if (attempts < 50) {
        turrets.push({
          id: `turret_${turretId++}`,
          x,
          y,
          width: SharedConstants.TURRET_SIZE,
          height: SharedConstants.TURRET_SIZE,
          health: SharedConstants.TURRET_MAX_HEALTH,
          maxHealth: SharedConstants.TURRET_MAX_HEALTH,
          damage: SharedConstants.TURRET_DAMAGE,
          range: SharedConstants.TURRET_RANGE,
          lastShootTime: 0,
          shootCooldown: SharedConstants.TURRET_SHOOT_COOLDOWN
        });
      }
    }
  }
  
  return turrets;
}

// Create cluster fragments (6 bullets in 360 degrees)
function createClusterFragments(game, bullet) {
  const fragmentCount = SharedConstants.BUFF_VALUES.CLUSTER_FRAG_COUNT || 6;
  const fragmentDamage = SharedConstants.BUFF_VALUES.CLUSTER_FRAG_DAMAGE || 10;
  const angleStep = (Math.PI * 2) / fragmentCount;
  
  for (let i = 0; i < fragmentCount; i++) {
    const angle = angleStep * i;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    
    game.bullets.push({
      id: game.bulletSeq++,
      x: bullet.x,
      y: bullet.y,
      dx: dx,
      dy: dy,
      speed: SharedConstants.BULLET_SPEED * 0.6, // Chậm hơn đạn thường
      ownerId: bullet.ownerId,
      damage: fragmentDamage,
      type: 1, // Đạn thường
      width: SharedConstants.BULLET_WIDTH * 0.7,
      height: SharedConstants.BULLET_HEIGHT * 0.7,
      isFragment: true,
      lifespan: 30 // ~0.5 giây ở 60fps
    });
  }
}

// Get walls near a rectangle using chunk index
function getWallsNear(map, rect) {
  const pad = 10;
  const startCx = Math.floor(Math.max(0, rect.x - pad) / map.chunkSize);
  const endCx = Math.floor(Math.min(map.width, rect.x + rect.width + pad) / map.chunkSize);
  const startCy = Math.floor(Math.max(0, rect.y - pad) / map.chunkSize);
  const endCy = Math.floor(Math.min(map.height, rect.y + rect.height + pad) / map.chunkSize);
  const walls = [];
  for (let cy = startCy; cy <= endCy; cy++) {
    for (let cx = startCx; cx <= endCx; cx++) {
      const key = `${cx},${cy}`;
      const arr = map.wallChunks.get(key);
      if (arr) walls.push(...arr);
    }
  }
  return walls;
}

// Create cluster fragments (6 đạn con toả 360 độ)
function createClusterFragments(game, bullet) {
  const fragmentCount = SharedConstants.BUFF_VALUES.CLUSTER_FRAG_COUNT;
  const fragmentDamage = SharedConstants.BUFF_VALUES.CLUSTER_FRAG_DAMAGE;
  const angleStep = (Math.PI * 2) / fragmentCount;
  
  for (let i = 0; i < fragmentCount; i++) {
    const angle = angleStep * i;
    game.bullets.push({
      id: game.bulletSeq++,
      x: bullet.x,
      y: bullet.y,
      dx: Math.cos(angle),
      dy: Math.sin(angle),
      speed: SharedConstants.BULLET_SPEED * 0.7, // Chậm hơn đạn gốc
      ownerId: bullet.ownerId,
      damage: fragmentDamage,
      type: 1, // Đạn con là đạn thường
      width: SharedConstants.BULLET_WIDTH * 0.7,
      height: SharedConstants.BULLET_HEIGHT * 0.7,
      isFragment: true, // Đánh dấu là đạn con
      lifespan: 30 // Chỉ sống 30 frames (~0.5s)
    });
  }
}

// Item spawning logic (simplified)
let itemSpawnTimer = 0;
function spawnItems(game) {
  itemSpawnTimer++;
  if (itemSpawnTimer >= SharedConstants.ITEM_SPAWN_INTERVAL) { // Spawn every 2 seconds (120 frames at 60fps)
    itemSpawnTimer = 0;
    // Count current items (6 types mới)
    let count = [0, 0, 0, 0, 0, 0];
    game.items.forEach(item => count[item.type - 1]++);

    const itemTargets = [
      SharedConstants.ITEM_TARGETS.HEALTH,
      SharedConstants.ITEM_TARGETS.SPEED,
      SharedConstants.ITEM_TARGETS.SHIELD,
      SharedConstants.ITEM_TARGETS.FIRE_AMMO,
      SharedConstants.ITEM_TARGETS.CLUSTER_AMMO,
      SharedConstants.ITEM_TARGETS.STEALTH
    ];
    let totalMissing = 0;
    for (let i = 0; i < 6; i++) {
      totalMissing += Math.max(0, itemTargets[i] - count[i]);
    }
    if (totalMissing === 0) return;

    let spawnCount = Math.min(3, totalMissing);
    for (let i = 0; i < spawnCount; i++) {
      let selectedType = -1;
      let maxMissing = 0;
      for (let j = 0; j < 6; j++) {
        let missing = itemTargets[j] - count[j];
        if (missing > maxMissing) {
          maxMissing = missing;
          selectedType = j + 1;
        }
      }
      if (selectedType === -1) break;
      count[selectedType - 1]++;

      let x, y, attempts = 0;
      do {
        x = Math.random() * game.map.width;
        y = Math.random() * game.map.height;
        attempts++;
      } while (attempts < 20 && game.map.walls.some(wall => 
        SharedUtils.isColliding({x, y, width: SharedConstants.ITEM_SIZE, height: SharedConstants.ITEM_SIZE}, wall)
      ));

      if (attempts < 20) {
        game.items.push({ x, y, type: selectedType });
      }
    }
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Tạo phòng mới
  socket.on('createRoom', (data) => {
    const { roomId } = data;
    if (games.has(roomId)) {
      socket.emit('roomNotFound');
      return;
    }
    
    socket.join(roomId);
    const gameMap = generateMap();
    games.set(roomId, {
      players: {},
      bullets: [],
      items: [],
      turrets: generateTurrets(gameMap), // Thêm turrets
      map: gameMap,
      isGameOver: false,
      winner: null,
      bulletSeq: 1,
      hostId: socket.id, // Lưu host
      isPlaying: false // Trạng thái game
    });
    
    const game = games.get(roomId);
    const isP1 = true;
    game.players[socket.id] = {
      id: 'p1',
      x: SharedConstants.PLAYER_P1_SPAWN.x,
      y: SharedConstants.PLAYER_P1_SPAWN.y,
      width: SharedConstants.TANK_WIDTH,
      height: SharedConstants.TANK_HEIGHT,
      speed: SharedConstants.TANK_BASE_SPEED,
      health: SharedConstants.PLAYER_MAX_HEALTH,
      maxHealth: SharedConstants.PLAYER_MAX_HEALTH,
      shield: SharedConstants.PLAYER_BASE_SHIELD,
      damage: SharedConstants.PLAYER_BASE_DAMAGE,
      bulletType: 1,
      lastDx: 0,
      lastDy: -1,
      angle: 0,
      keys: { up: false, down: false, left: false, right: false, shoot: false, priority: [] },
      canShoot: true,
      lastShootTime: 0,
      shootCooldown: SharedConstants.SHOOT_COOLDOWN,
      defaultSpeed: SharedConstants.TANK_BASE_SPEED,
      defaultDamage: SharedConstants.PLAYER_BASE_DAMAGE,
      defaultBulletType: 1,
      buffTimers: {
        speed: 0,
        shield: 0,
        fireAmmo: 0,
        clusterAmmo: 0,
        stealth: 0
      },
      spawnProtection: 0,
      isInvisible: false,
      lastProcessedInputSeq: -1
    };
    
    socket.emit('roomCreated', { roomId, playerId: socket.id, isP1: true });
    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  // Tham gia phòng (tự động khi có người thứ 2 connect)
  socket.on('joinRoom', (data) => {
    const { roomId } = data;
    console.log(`Player ${socket.id} attempting to join room: ${roomId}`);
    console.log('Available rooms:', Array.from(games.keys()));
    const game = games.get(roomId);
    
    if (!game) {
      console.log(`Room ${roomId} not found!`);
      socket.emit('roomNotFound');
      return;
    }
    
    const playerIds = Object.keys(game.players);
    if (playerIds.length >= 2) {
      socket.emit('roomFull');
      return;
    }
    
    socket.join(roomId);
    const isP1 = false;
    game.players[socket.id] = {
      id: 'p2',
      x: game.map.width - SharedConstants.PLAYER_P2_SPAWN_OFFSET.x,
      y: game.map.height - SharedConstants.PLAYER_P2_SPAWN_OFFSET.y,
      width: SharedConstants.TANK_WIDTH,
      height: SharedConstants.TANK_HEIGHT,
      speed: SharedConstants.TANK_BASE_SPEED,
      health: SharedConstants.PLAYER_MAX_HEALTH,
      maxHealth: SharedConstants.PLAYER_MAX_HEALTH,
      shield: SharedConstants.PLAYER_BASE_SHIELD,
      damage: SharedConstants.PLAYER_BASE_DAMAGE,
      bulletType: 1,
      lastDx: 0,
      lastDy: -1,
      angle: 0,
      keys: { up: false, down: false, left: false, right: false, shoot: false, priority: [] },
      canShoot: true,
      lastShootTime: 0,
      shootCooldown: SharedConstants.SHOOT_COOLDOWN,
      defaultSpeed: SharedConstants.TANK_BASE_SPEED,
      defaultDamage: SharedConstants.PLAYER_BASE_DAMAGE,
      defaultBulletType: 1,
      buffTimers: {
        speed: 0,
        shield: 0,
        fireAmmo: 0,
        clusterAmmo: 0,
        stealth: 0
      },
      spawnProtection: 0,
      isInvisible: false,
      lastProcessedInputSeq: -1
    };
    
    socket.emit('joined', { playerId: socket.id, isP1: false });
    socket.emit('joinedRoom', { playerId: socket.id, isP1: false, playerCount: Object.keys(game.players).length });
    io.to(roomId).emit('playerJoined', { playerCount: Object.keys(game.players).length });
    console.log(`Player joined room: ${roomId}`);
  });

  // Bắt đầu game (chỉ host mới được) - TẠO MAP MỚI ỞỎY
  socket.on('startGame', (data) => {
    const { roomId } = data;
    const game = games.get(roomId);
    
    if (!game) return;
    const playerIds = Object.keys(game.players);
    if (playerIds.length === 0) return;
    // Nếu host đã rời, gán host mới là player đầu tiên
    if (!game.players[game.hostId]) {
      game.hostId = playerIds[0];
      io.to(roomId).emit('hostChanged', { hostId: game.hostId });
    }
    if (game.hostId !== socket.id) {
      return; // Không phải host hiện tại
    }
    
    if (Object.keys(game.players).length < 2) {
      return; // Chưa đủ người
    }

    // === TẠO MAP VÀ TURRETS MỚI TRƯỚC KHI BẮT ĐẦU ===
    const newMap = generateMap();
    game.map = newMap;
    game.turrets = generateTurrets(newMap);

    // Reset players về spawn point mới (map vừa tạo) và hồi đầy trạng thái
    for (let [pid, player] of Object.entries(game.players)) {
      if (player.id === 'p1') {
        player.x = SharedConstants.PLAYER_P1_SPAWN.x;
        player.y = SharedConstants.PLAYER_P1_SPAWN.y;
      } else {
        player.x = game.map.width - SharedConstants.PLAYER_P2_SPAWN_OFFSET.x;
        player.y = game.map.height - SharedConstants.PLAYER_P2_SPAWN_OFFSET.y;
      }

      // Hồi máu, giáp, sát thương, đạn và di chuyển về mặc định
      player.health = player.maxHealth;
      player.shield = SharedConstants.PLAYER_BASE_SHIELD;
      player.damage = player.defaultDamage ?? SharedConstants.PLAYER_BASE_DAMAGE;
      player.bulletType = player.defaultBulletType ?? 1;
      player.speed = player.defaultSpeed ?? SharedConstants.TANK_BASE_SPEED;
      player.isInvisible = false;
      delete player.burnEffect;

      // Reset buff timers
      player.buffTimers = {
        speed: 0,
        shield: 0,
        fireAmmo: 0,
        clusterAmmo: 0,
        stealth: 0
      };

      // Miễn sát thương vài giây đầu
      player.spawnProtection = SPAWN_PROTECTION_FRAMES;

      // Reset input / cooldowns
      player.keys = { up: false, down: false, left: false, right: false, shoot: false, priority: [] };
      player.canShoot = true;
      player.lastShootTime = 0;
      player.lastDx = 0;
      player.lastDy = -1;
    }

    game.bullets = [];
    game.items = [];
    game.bulletSeq = 1;
    game.isGameOver = false;
    game.winner = null;
    game.isPlaying = true;
    itemSpawnTimer = 0;

    io.to(roomId).emit('gameStarted');
    io.to(roomId).emit('gameState', game);
    console.log(`Game started in room: ${roomId}`);
  });



  // Rời phòng
  socket.on('leaveRoom', (data) => {
    const { roomId } = data;
    const game = games.get(roomId);
    if (game) {
      const wasHost = game.hostId === socket.id;
      
      delete game.players[socket.id];
      socket.leave(roomId);
      
      const remaining = Object.keys(game.players);
      if (remaining.length === 0) {
        games.delete(roomId);
        console.log(`Room deleted: ${roomId}`);
      } else {
        // Nếu là host, kick tất cả thành viên còn lại về lobby
        if (wasHost) {
          io.to(roomId).emit('hostLeft');
          remaining.forEach(socketId => {
            io.sockets.sockets.get(socketId)?.leave(roomId);
          });
          games.delete(roomId);
          console.log(`Host left room ${roomId}, all players kicked out`);
        } else if (game.isPlaying && !game.isGameOver) {
          // Nếu game đang chơi, người còn lại thắng
          game.isGameOver = true;
          const remainingPlayer = game.players[remaining[0]];
          game.winner = remainingPlayer.id;
          io.to(roomId).emit('gameState', game);
          console.log(`Player left room during game. Winner: ${game.winner}`);
        }
      }
    }
  });

  // Ensure player input is processed correctly for tank control
  socket.on('playerInput', (data) => {
    const { roomId, input } = data;
    const game = games.get(roomId);
    if (game && game.players[socket.id]) {
      const player = game.players[socket.id];
      const { seq, ...keyState } = input || {};
      player.keys = keyState;
      player.lastProcessedInputSeq = typeof seq === 'number' ? seq : (player.lastProcessedInputSeq ?? -1);
      if (!keyState.shoot) player.canShoot = true;
    }
  });

  socket.on('disconnect', () => {
    for (let [roomId, game] of games) {
      if (game.players[socket.id]) {
        const wasHost = game.hostId === socket.id;
        
        delete game.players[socket.id];
        const remaining = Object.keys(game.players);
        
        if (remaining.length === 0) {
          console.log(`Deleted empty room: ${roomId}`);
          games.delete(roomId);
        } else {
          // Nếu là host disconnect, kick tất cả thành viên về lobby
          if (wasHost) {
            io.to(roomId).emit('hostLeft');
            remaining.forEach(socketId => {
              io.sockets.sockets.get(socketId)?.leave(roomId);
            });
            games.delete(roomId);
            console.log(`Host disconnected from room ${roomId}, all players kicked out`);
          } else if (game.isPlaying && !game.isGameOver) {
            // Nếu game đang chơi, người còn lại thắng
            game.isGameOver = true;
            const remainingPlayer = game.players[remaining[0]];
            game.winner = remainingPlayer.id;
            io.to(roomId).emit('gameState', game);
            console.log(`Player disconnected during game. Winner: ${game.winner}`);
          }
        }
        break;
      }
    }
  });
});

// Physics loop on server (run every 16ms ~60fps)
// Tính toán vật lý chạy ở 60fps để đảm bảo gameplay chính xác và mượt mà
const PHYSICS_INTERVAL = 1000 / SharedConstants.PHYSICS_UPDATE_RATE;
const physicsLoopId = setInterval(() => {
  try {
    for (let [roomId, game] of games) {
      // Chỉ chạy physics khi game đang playing
      if (!game.isPlaying || game.isGameOver) continue;

      // Update players
      for (let [id, player] of Object.entries(game.players)) {
        let dx = 0, dy = 0;
        
        // === MOVEMENT PRIORITY SYSTEM (ƯU TIÊN PHÍM MỚI NHẤT) ===
        // Hệ thống này xử lý tình huống nhấn nhiều phím cùng lúc
        // Ưu tiên: Phím nhấn mới nhất + Xử lý xung đột (up vs down, left vs right)
        const priority = player.keys.priority || [];
        
        if (priority.length > 0) {
          // Lấy phím gần nhất từ priority array
          // Duyệt từ cuối về đầu (phím mới nhất đến cũ nhất)
          let verticalSet = false;
          let horizontalSet = false;
          
          for (let i = priority.length - 1; i >= 0; i--) {
            const key = priority[i];
            
            // Xử lý vertical (up/down) - chỉ lấy phím mới nhất
            if (!verticalSet) {
              if (key === 'up') { dy = -1; verticalSet = true; }
              else if (key === 'down') { dy = 1; verticalSet = true; }
            }
            
            // Xử lý horizontal (left/right) - chỉ lấy phím mới nhất
            if (!horizontalSet) {
              if (key === 'left') { dx = -1; horizontalSet = true; }
              else if (key === 'right') { dx = 1; horizontalSet = true; }
            }
            
            // Nếu đã có cả vertical và horizontal thì dừng
            if (verticalSet && horizontalSet) break;
          }
        } else {
          // Fallback: Nếu không có priority, dùng logic cũ
          if (player.keys.up) dy = -1;
          if (player.keys.down) dy = 1;
          if (player.keys.left) dx = -1;
          if (player.keys.right) dx = 1;
        }

        // Update last direction
        if (dx !== 0 || dy !== 0) {
            player.lastDx = dx;
            player.lastDy = dy;
        }

        // Update player position
        player.x += dx * player.speed;
        player.y += dy * player.speed;

        // Boundary check
        player.x = Math.max(0, Math.min(player.x, game.map.width - player.width));
        player.y = Math.max(0, Math.min(player.y, game.map.height - player.height));

        // Wall collision check with reduced hitbox
        const nearbyWalls = getWallsNear(game.map, player);
        for (let wall of nearbyWalls) {
          // Thu nhỏ hitbox xe tăng để đi qua khe hẹp dễ hơn (padding from SharedConstants)
          const padding = SharedConstants.TANK_HITBOX_PADDING;
          const playerHitbox = {
            x: player.x + padding,
            y: player.y + padding,
            width: player.width - padding * 2,
            height: player.height - padding * 2
          };
          if (SharedUtils.isColliding(playerHitbox, wall)) {
            player.x -= dx * player.speed;
            player.y -= dy * player.speed;
            break;
          }
        }

        // Shooting logic (với cooldown)
        const now = Date.now();
        if (player.keys.shoot && player.canShoot && (now - player.lastShootTime >= player.shootCooldown)) {
            // Bắn súng -> Mất tàng hình
            if (player.isInvisible) {
              player.isInvisible = false;
              player.buffTimers.stealth = 0;
            }
            
            // Tính tâm xe tăng
            const centerX = player.x + player.width / 2;
            const centerY = player.y + player.height / 2;
            
            // Tính góc quay của xe tăng (giống client)
            let angle = Math.atan2(player.lastDy, player.lastDx);
            angle += Math.PI / 2; // Điều chỉnh vì ảnh xe tăng mặc định hướng lên
            
            // === CẤU HÌNH VỊ TRÍ SPAWN ĐẠN ===
            // barrelLength: Khoảng cách từ tâm xe tăng đến đầu nòng súng (pixels)
            const barrelLength = SharedConstants.BULLET_BARREL_LENGTH;
            
            // barrelOffset: Độ lệch ngang (perpendicular) so với hướng xe tăng
            const barrelOffsetX = 0;  // Offset ngang (pixels)
            const barrelOffsetY = 0;  // Offset dọc (pixels)
            
            // Tính vị trí spawn dựa trên angle và offsets
            const spawnX = centerX + Math.cos(angle - Math.PI / 2) * barrelLength + Math.cos(angle) * barrelOffsetX;
            const spawnY = centerY + Math.sin(angle - Math.PI / 2) * barrelLength + Math.sin(angle) * barrelOffsetY;
            // === HẾT CẤU HÌNH ===
            
            game.bullets.push({
              id: game.bulletSeq++,
                x: spawnX,
                y: spawnY,
                dx: player.lastDx,
                dy: player.lastDy,
                speed: SharedConstants.BULLET_SPEED,
                ownerId: player.id,
                damage: player.damage,
                type: player.bulletType,
                width: SharedConstants.BULLET_WIDTH,
                height: SharedConstants.BULLET_HEIGHT
            });
            player.canShoot = false;
            player.lastShootTime = now;
        }
      }

      // === TURRET AI LOGIC ===
      const now = Date.now();
      game.turrets.forEach(turret => {
        if (turret.health <= 0) return; // Turret đã chết
        
        // Tìm người chơi gần nhất trong tầm bắn
        let closestPlayer = null;
        let closestDist = turret.range + 1;
        
        for (let [id, player] of Object.entries(game.players)) {
          if (player.health <= 0) continue;
          if (player.isInvisible) continue; // Bỏ qua người chơi bị tàng hình
          
          const dx = player.x + player.width / 2 - (turret.x + turret.width / 2);
          const dy = player.y + player.height / 2 - (turret.y + turret.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < closestDist) {
            closestDist = dist;
            closestPlayer = player;
          }
        }
        
        // Nếu có target và đủ cooldown -> bắn
        if (closestPlayer && now - turret.lastShootTime >= turret.shootCooldown) {
          const centerX = turret.x + turret.width / 2;
          const centerY = turret.y + turret.height / 2;
          const targetX = closestPlayer.x + closestPlayer.width / 2;
          const targetY = closestPlayer.y + closestPlayer.height / 2;
          
          const dx = targetX - centerX;
          const dy = targetY - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          game.bullets.push({
            id: game.bulletSeq++,
            x: centerX,
            y: centerY,
            dx: dx / dist,
            dy: dy / dist,
            speed: SharedConstants.BULLET_SPEED,
            ownerId: turret.id,
            damage: turret.damage,
            type: 1, // Đạn thường
            width: SharedConstants.BULLET_WIDTH,
            height: SharedConstants.BULLET_HEIGHT
          });
          
          turret.lastShootTime = now;
        }
      });

      // Update bullets
      game.bullets.forEach(bullet => {
        bullet.x += bullet.dx * bullet.speed;
        bullet.y += bullet.dy * bullet.speed;
        
        // Fragment bullets: giảm lifespan
        if (bullet.isFragment && bullet.lifespan !== undefined) {
          bullet.lifespan--;
          if (bullet.lifespan <= 0) {
            bullet.markedForDeletion = true;
          }
        }
        
        // Boundary check
        if (bullet.x < 0 || bullet.x > game.map.width || bullet.y < 0 || bullet.y > game.map.height) {
          bullet.markedForDeletion = true;
        }
      });

      // Bullet collisions
      game.bullets.forEach(bullet => {
        // Wall (use nearby chunks)
        const nearWalls = getWallsNear(game.map, bullet);
        for (let wall of nearWalls) {
          if (bullet.type !== 2 && SharedUtils.isColliding(bullet, wall)) {
            // Cluster Ammo: Nổ ra đạn con khi chạm tường
            if (bullet.type === 5) {
              createClusterFragments(game, bullet);
            }
            bullet.markedForDeletion = true;
            break;
          }
        }
        
        // Players (từ turrets hoặc từ players khác)
        for (let [id, player] of Object.entries(game.players)) {
          if (bullet.ownerId !== player.id && SharedUtils.isColliding(bullet, player)) {
            // Spawn protection: bỏ qua sát thương trong vài giây đầu
            if (player.spawnProtection && player.spawnProtection > 0) {
              bullet.markedForDeletion = true;
              break;
            }
            // Stealth: Bỏ qua sát thương khi bị tàng hình
            if (player.isInvisible) {
              bullet.markedForDeletion = true;
              break;
            }
            // Damage cơ bản
            player.health -= bullet.damage - player.shield;
            
            // Fire Ammo: Gây burn effect
            if (bullet.type === 4) {
              player.burnEffect = {
                damage: SharedConstants.BUFF_VALUES.FIRE_DOT_DAMAGE,
                duration: SharedConstants.BUFF_VALUES.FIRE_DOT_DURATION
              };
            }
            
            // Cluster Ammo: Nổ ra đạn con
            if (bullet.type === 5) {
              createClusterFragments(game, bullet);
            }
            
            bullet.markedForDeletion = true;
          }
        }
        
        // Turrets (players có thể bắn turrets)
        if (!bullet.ownerId.startsWith('turret_')) {
          for (let turret of game.turrets) {
            if (turret.health > 0 && SharedUtils.isColliding(bullet, turret)) {
              turret.health -= bullet.damage;
              
              // Cluster Ammo: Nổ khi trúng turret
              if (bullet.type === 5) {
                createClusterFragments(game, bullet);
              }
              
              bullet.markedForDeletion = true;
              break;
            }
          }
        }
      });

      // Item pickup collision
      for (let [id, player] of Object.entries(game.players)) {
        for (let i = game.items.length - 1; i >= 0; i--) {
          const item = game.items[i];
          const itemRect = { x: item.x, y: item.y, width: SharedConstants.ITEM_SIZE, height: SharedConstants.ITEM_SIZE };
          if (SharedUtils.isColliding(player, itemRect)) {
            // Apply item effect based on type (6 types mới)
            switch(item.type) {
              case 1: // Health
                player.health = Math.min(player.maxHealth, player.health + SharedConstants.BUFF_VALUES.HEALTH_RESTORE);
                break;
              case 2: // Speed boost (10s)
                player.buffTimers.speed = Math.max(player.buffTimers.speed, SharedConstants.BUFF_DURATION.SPEED);
                player.speed = player.defaultSpeed + SharedConstants.BUFF_VALUES.SPEED_BOOST;
                break;
              case 3: // Shield (15s)
                player.shield = SharedConstants.BUFF_VALUES.SHIELD_VALUE;
                player.buffTimers.shield = SharedConstants.BUFF_DURATION.SHIELD;
                break;
              case 4: // Fire Ammo (12s)
                player.bulletType = 4;
                player.buffTimers.fireAmmo = SharedConstants.BUFF_DURATION.FIRE_AMMO;
                player.buffTimers.clusterAmmo = 0; // Cancel cluster
                break;
              case 5: // Cluster Ammo (12s)
                player.bulletType = 5;
                player.buffTimers.clusterAmmo = SharedConstants.BUFF_DURATION.CLUSTER_AMMO;
                player.buffTimers.fireAmmo = 0; // Cancel fire
                break;
              case 6: // Stealth (10s)
                player.isInvisible = true;
                player.buffTimers.stealth = SharedConstants.BUFF_DURATION.STEALTH;
                break;
            }
            // Remove item after pickup
            game.items.splice(i, 1);
          }
        }
      }

      // Update buff timers and reset stats when expired
      for (let [id, player] of Object.entries(game.players)) {
        // Speed buff
        if (player.buffTimers.speed > 0) {
          player.speed = player.defaultSpeed + SharedConstants.BUFF_VALUES.SPEED_BOOST;
          player.buffTimers.speed--;
          if (player.buffTimers.speed === 0) {
            player.speed = player.defaultSpeed;
          }
        }
        // Shield buff
        if (player.buffTimers.shield > 0) {
          player.buffTimers.shield--;
          if (player.buffTimers.shield === 0) {
            player.shield = 0;
          }
        }
        // Fire Ammo buff
        if (player.buffTimers.fireAmmo > 0) {
          player.buffTimers.fireAmmo--;
          if (player.buffTimers.fireAmmo === 0) {
            player.bulletType = player.defaultBulletType;
          }
        }
        // Cluster Ammo buff
        if (player.buffTimers.clusterAmmo > 0) {
          player.buffTimers.clusterAmmo--;
          if (player.buffTimers.clusterAmmo === 0) {
            player.bulletType = player.defaultBulletType;
          }
        }
        // Stealth buff
        if (player.buffTimers.stealth > 0) {
          player.buffTimers.stealth--;
          if (player.buffTimers.stealth === 0) {
            player.isInvisible = false;
          }
        }

        // Giảm dần spawn protection (miễn sát thương)
        if (player.spawnProtection && player.spawnProtection > 0) {
          player.spawnProtection--;
        }
        
        // Burn effect (Fire DOT)
        if (player.burnEffect) {
          // Nếu đang trong spawn protection hoặc tàng hình thì không trừ máu
          if ((player.spawnProtection && player.spawnProtection > 0) || player.isInvisible) {
            player.burnEffect.duration--;
            if (player.burnEffect.duration <= 0) delete player.burnEffect;
          } else {
          player.health -= player.burnEffect.damage;
          player.burnEffect.duration--;
          if (player.burnEffect.duration <= 0) {
            delete player.burnEffect;
          }
          }
        }
      }

      game.bullets = game.bullets.filter(b => {
        if (b.markedForDeletion) return false;
        if (b.x < -50 || b.x > game.map.width + 50 || b.y < -50 || b.y > game.map.height + 50) return false;
        return true;
      });

      // Limit total bullets per room
      if (game.bullets.length > SharedConstants.MAX_BULLETS_PER_ROOM) {
        game.bullets = game.bullets.slice(-SharedConstants.MAX_BULLETS_PER_ROOM);
      }

      // Check win/lose
      const players = Object.values(game.players);
      if (players.length === 2) {
        if (players[0].health <= 0) {
          game.isGameOver = true;
          game.winner = players[1].id;
        } else if (players[1].health <= 0) {
          game.isGameOver = true;
          game.winner = players[0].id;
        }
      }

      // Spawn items
      spawnItems(game);
    }
  } catch (e) {
    console.error('Physics loop error:', e);
  }
}, PHYSICS_INTERVAL);

// Network loop - Send updates at 30fps (33ms) để giảm tải băng thông
// Gửi ở tần suất thấp hơn physics (30fps thay vì 60fps) vẫn đủ mượt cho mắt thường
// và giảm đáng kể network traffic, tránh lag qua internet
const NETWORK_INTERVAL = 1000 / SharedConstants.NETWORK_UPDATE_RATE;
const networkLoopId = setInterval(() => {
  try {
    for (let [roomId, game] of games) {
      // Chỉ gửi update khi game đang playing
      if (!game.isPlaying) continue;
      
      // Broadcast per-player with nearby bullets/items only
      for (let [sockId, pl] of Object.entries(game.players)) {
        const view = buildViewStateFor(game, pl);
        io.to(sockId).emit('updateState', view);
      }
    }
  } catch (e) {
    console.error('Network loop error:', e);
  }
}, NETWORK_INTERVAL);

// Collision utility (now using SharedUtils)
function isColliding(rect1, rect2) {
  return SharedUtils.isColliding(rect1, rect2);
}

// Build a trimmed state for a specific player (Minecraft-like: only nearby)
function buildViewStateFor(game, player) {
  const padX = SharedConstants.VIEW_PADDING_X; // radius X to include entities
  const padY = SharedConstants.VIEW_PADDING_Y; // radius Y to include entities
  const rect = {
    x: Math.max(0, player.x - padX),
    y: Math.max(0, player.y - padY),
    width: padX * 2,
    height: padY * 2
  };

  const bullets = game.bullets.filter(b => (
    b.x >= rect.x && b.x <= rect.x + rect.width &&
    b.y >= rect.y && b.y <= rect.y + rect.height
  ));

  const items = game.items.filter(i => (
    i.x + 30 >= rect.x && i.x <= rect.x + rect.width &&
    i.y + 30 >= rect.y && i.y <= rect.y + rect.height
  ));
  
  // Turrets trong viewport (luôn gửi toàn bộ để client vẽ mini-map)
  const turrets = game.turrets;

  return {
    players: game.players,
    playerData: game.playerData,
    bullets,
    items,
    turrets,
    map: { width: game.map.width, height: game.map.height },
    isGameOver: game.isGameOver,
    winner: game.winner
  };
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));