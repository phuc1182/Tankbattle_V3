const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import shared constants and utils
const SharedConstants = require('../shared/SharedConstants.js');
const SharedUtils = require('../shared/SharedUtils.js');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" },
  pingInterval: 10000,    // Ping every 10s
  pingTimeout: 30000,     // Wait 30s for pong before disconnect
  maxHttpBufferSize: 1e6  // 1MB buffer
});

const PORT = 3000;

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

// Item spawning logic (simplified)
let itemSpawnTimer = 0;
function spawnItems(game) {
  itemSpawnTimer++;
  if (itemSpawnTimer >= SharedConstants.ITEM_SPAWN_INTERVAL) { // Spawn every 2 seconds (120 frames at 60fps)
    itemSpawnTimer = 0;
    // Count current items (6 types)
    let count = [0, 0, 0, 0, 0, 0];
    game.items.forEach(item => count[item.type - 1]++);

    const itemTargets = [
      SharedConstants.ITEM_TARGETS.HEALTH,
      SharedConstants.ITEM_TARGETS.SPEED,
      SharedConstants.ITEM_TARGETS.SHIELD,
      SharedConstants.ITEM_TARGETS.DAMAGE,
      SharedConstants.ITEM_TARGETS.PIERCING,
      SharedConstants.ITEM_TARGETS.EXPLOSIVE
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
    games.set(roomId, {
      players: {},
      bullets: [],
      items: [],
      map: generateMap(),
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
      keys: { up: false, down: false, left: false, right: false, shoot: false },
      canShoot: true,
      lastShootTime: 0,
      shootCooldown: SharedConstants.SHOOT_COOLDOWN,
      defaultSpeed: SharedConstants.TANK_BASE_SPEED,
      defaultDamage: SharedConstants.PLAYER_BASE_DAMAGE,
      defaultBulletType: 1,
      buffTimers: {
        speed: 0,
        shield: 0,
        damage: 0,
        piercing: 0,
        explosive: 0
      }
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
      keys: { up: false, down: false, left: false, right: false, shoot: false },
      canShoot: true,
      lastShootTime: 0,
      shootCooldown: SharedConstants.SHOOT_COOLDOWN,
      defaultSpeed: SharedConstants.TANK_BASE_SPEED,
      defaultDamage: SharedConstants.PLAYER_BASE_DAMAGE,
      defaultBulletType: 1,
      buffTimers: {
        speed: 0,
        shield: 0,
        damage: 0,
        piercing: 0,
        explosive: 0
      }
    };
    
    socket.emit('joined', { playerId: socket.id, isP1: false });
    socket.emit('joinedRoom', { playerId: socket.id, isP1: false, playerCount: Object.keys(game.players).length });
    io.to(roomId).emit('playerJoined', { playerCount: Object.keys(game.players).length });
    console.log(`Player joined room: ${roomId}`);
  });

  // Bắt đầu game (chỉ host mới được)
  socket.on('startGame', (data) => {
    const { roomId } = data;
    const game = games.get(roomId);
    
    if (!game || game.hostId !== socket.id) {
      return; // Không phải host
    }
    
    if (Object.keys(game.players).length < 2) {
      return; // Chưa đủ người
    }
    
    game.isPlaying = true;
    io.to(roomId).emit('gameStarted');
    io.to(roomId).emit('gameState', game);
    console.log(`Game started in room: ${roomId}`);
  });

  // Rời phòng
  socket.on('leaveRoom', (data) => {
    const { roomId } = data;
    const game = games.get(roomId);
    if (game) {
      delete game.players[socket.id];
      socket.leave(roomId);
      
      // Nếu phòng rỗng hoặc host rời thì xóa phòng
      if (Object.keys(game.players).length === 0 || game.hostId === socket.id) {
        games.delete(roomId);
        console.log(`Room deleted: ${roomId}`);
      }
    }
  });

  // Ensure player input is processed correctly for tank control
  socket.on('playerInput', (data) => {
    const { roomId, input } = data;
    const game = games.get(roomId);
    if (game && game.players[socket.id]) {
      const player = game.players[socket.id];
      player.keys = input;
      if (!input.shoot) player.canShoot = true;
    }
  });

  socket.on('disconnect', () => {
    for (let [roomId, game] of games) {
      delete game.players[socket.id];
      // Cleanup room if empty
      if (Object.keys(game.players).length === 0) {
        console.log(`Deleted empty room: ${roomId}`);
        games.delete(roomId);
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

      // Update bullets
      game.bullets.forEach(bullet => {
        bullet.x += bullet.dx * bullet.speed;
        bullet.y += bullet.dy * bullet.speed;
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
            bullet.markedForDeletion = true;
            break;
          }
        }
        // Players
        for (let [id, player] of Object.entries(game.players)) {
          if (bullet.ownerId !== player.id && SharedUtils.isColliding(bullet, player)) {
            player.health -= bullet.damage - player.shield;
            if (bullet.type === 3) player.health -= SharedConstants.BUFF_VALUES.EXPLOSIVE_BONUS;
            bullet.markedForDeletion = true;
          }
        }
      });

      // Item pickup collision
      for (let [id, player] of Object.entries(game.players)) {
        for (let i = game.items.length - 1; i >= 0; i--) {
          const item = game.items[i];
          const itemRect = { x: item.x, y: item.y, width: SharedConstants.ITEM_SIZE, height: SharedConstants.ITEM_SIZE };
          if (SharedUtils.isColliding(player, itemRect)) {
            // Apply item effect based on type (6 active items)
            switch(item.type) {
              case 1: // Health
                player.health = Math.min(player.maxHealth, player.health + SharedConstants.BUFF_VALUES.HEALTH_RESTORE);
                break;
              case 2: // Speed boost (10s)
                player.buffTimers.speed = Math.max(player.buffTimers.speed, SharedConstants.BUFF_DURATION.SPEED); // refresh/extend
                player.speed = player.defaultSpeed + SharedConstants.BUFF_VALUES.SPEED_BOOST;
                break;
              case 3: // Shield (15s)
                player.shield = SharedConstants.BUFF_VALUES.SHIELD_VALUE;
                player.buffTimers.shield = SharedConstants.BUFF_DURATION.SHIELD;
                break;
              case 4: // Damage boost (10s)
                player.damage = player.defaultDamage + SharedConstants.BUFF_VALUES.DAMAGE_BOOST;
                player.buffTimers.damage = SharedConstants.BUFF_DURATION.DAMAGE;
                break;
              case 5: // Piercing bullets (12s)
                player.bulletType = 2;
                player.buffTimers.piercing = SharedConstants.BUFF_DURATION.PIERCING;
                player.buffTimers.explosive = 0; // cancel explosive
                break;
              case 6: // Explosive bullets (12s)
                player.bulletType = 3;
                player.buffTimers.explosive = SharedConstants.BUFF_DURATION.EXPLOSIVE;
                player.buffTimers.piercing = 0; // cancel piercing
                break;
            }
            // Remove item after pickup
            game.items.splice(i, 1);
          }
        }
      }

      // Update buff timers and reset stats when expired
      for (let [id, player] of Object.entries(game.players)) {
        // Speed buff (keep boosted speed while active)
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
        // Damage buff
        if (player.buffTimers.damage > 0) {
          player.buffTimers.damage--;
          if (player.buffTimers.damage === 0) {
            player.damage = player.defaultDamage;
          }
        }
        // Piercing buff
        if (player.buffTimers.piercing > 0) {
          player.buffTimers.piercing--;
          if (player.buffTimers.piercing === 0) {
            player.bulletType = player.defaultBulletType;
          }
        }
        // Explosive buff
        if (player.buffTimers.explosive > 0) {
          player.buffTimers.explosive--;
          if (player.buffTimers.explosive === 0) {
            player.bulletType = player.defaultBulletType;
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

  return {
    players: game.players,
    bullets,
    items,
    map: { width: game.map.width, height: game.map.height },
    isGameOver: game.isGameOver,
    winner: game.winner
  };
}

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));