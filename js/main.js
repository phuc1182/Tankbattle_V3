// main.js - File chính khởi động game

// Lấy Context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Socket connection
const socket = io(window.location.origin, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});
window.socket = socket; // Make socket global for Tank.js

// Set canvas for Game
window.canvas = canvas;
window.ctx = ctx;

// UI elements
const lobbyLayer = document.getElementById('lobby-layer');
const waitingLayer = document.getElementById('waiting-layer');
const loadingLayer = document.getElementById('loading-layer');
const loadingProgressBar = document.getElementById('loading-progress');
const loadingText = document.getElementById('loading-text');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const startGameBtn = document.getElementById('startGameBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const roomIdText = document.getElementById('room-id-text');
const playerCountText = document.getElementById('player-count-text');
const copyRoomIdBtn = document.getElementById('copyRoomIdBtn');

window.isHost = false;

// Create room
createRoomBtn.addEventListener('click', () => {
    const roomId = Math.random().toString(36).substr(2, 8).toUpperCase();
    socket.emit('createRoom', { roomId });
    window.roomId = roomId;
    window.isHost = true;
});

// Join room
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('Vui lòng nhập Room ID!');
        return;
    }
    console.log('Attempting to join room:', roomId);
    socket.emit('joinRoom', { roomId });
    window.roomId = roomId;
    window.isHost = false;
});

// Start game (chỉ host mới có nút này)
startGameBtn.addEventListener('click', () => {
    socket.emit('startGame', { roomId: window.roomId });
});

// Copy Room ID
copyRoomIdBtn.addEventListener('click', () => {
    const roomId = window.roomId;
    console.log('Copying Room ID:', roomId, 'Length:', roomId?.length);
    if (!roomId) {
        alert('Chưa có Room ID!');
        return;
    }
    navigator.clipboard.writeText(roomId).then(() => {
        const originalText = copyRoomIdBtn.textContent;
        copyRoomIdBtn.textContent = '✓ ĐÃ COPY!';
        copyRoomIdBtn.style.backgroundColor = '#27ae60';
        console.log('Successfully copied:', roomId);
        setTimeout(() => {
            copyRoomIdBtn.textContent = originalText;
            copyRoomIdBtn.style.backgroundColor = '#3498db';
        }, 2000);
    }).catch(err => {
        alert('Không thể copy. Vui lòng copy thủ công: ' + roomId);
        console.error('Copy failed:', err);
    });
});

// Leave room
leaveRoomBtn.addEventListener('click', () => {
    socket.emit('leaveRoom', { roomId: window.roomId });
    waitingLayer.style.display = 'none';
    lobbyLayer.style.display = 'flex';
    window.roomId = null;
    roomIdInput.value = '';
});

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    // Chỉ cảnh báo nếu không tự động reconnect được
    // Socket.IO sẽ tự thử reconnect theo cấu hình
});

socket.io.on('reconnect_attempt', (attempt) => {
    console.log('Reconnecting...', attempt);
});

socket.io.on('reconnect', (attempt) => {
    console.log('Reconnected after', attempt, 'attempt(s)');
});

socket.io.on('reconnect_failed', () => {
    console.error('Reconnection failed');
    alert('Mất kết nối với server. Vui lòng tải lại trang.');
});

socket.on('roomCreated', (data) => {
    console.log('Room created event received:', data);
    console.log('Room ID:', data.roomId, 'Length:', data.roomId.length);
    lobbyLayer.style.display = 'none';
    waitingLayer.style.display = 'flex';
    roomIdText.textContent = data.roomId;
    window.roomId = data.roomId; // Đảm bảo window.roomId được set
    playerCountText.textContent = '1/2';
    window.playerId = data.playerId;
    window.isP1 = data.isP1;
    window.isHost = true;
    // Host có nút Start (hiển khi đủ 2 người)
    startGameBtn.style.display = 'none';
    console.log('Room ID displayed:', roomIdText.textContent, 'window.roomId:', window.roomId);
});
socket.on('joinedRoom', (data) => {
    console.log('Successfully joined room!', data);
    lobbyLayer.style.display = 'none';
    waitingLayer.style.display = 'flex';
    roomIdText.textContent = window.roomId;
    playerCountText.textContent = data.playerCount + '/2';
    window.playerId = data.playerId;
    window.isP1 = data.isP1;
    window.isHost = false;
    if (data.playerCount === 2) {
        document.querySelector('.waiting-msg').textContent = 'Đủ người chơi! Đang chờ host bắt đầu...';
    }
});
socket.on('playerJoined', (data) => {
    playerCountText.textContent = data.playerCount + '/2';
    if (data.playerCount === 2 && window.isHost) {
        // Hiển nút Start cho host
        startGameBtn.style.display = 'block';
        document.querySelector('.waiting-msg').textContent = 'Đủ người chơi! Nhấn Start để bắt đầu.';
    } else if (data.playerCount === 2) {
        document.querySelector('.waiting-msg').textContent = 'Đủ người chơi! Đang chờ host bắt đầu...';
    }
});

socket.on('roomFull', () => {
    alert('Phòng đã đầy! Mỗi phòng chỉ chứa tối đa 2 người chơi.');
    window.roomId = null;
    roomIdInput.value = '';
});

socket.on('roomNotFound', () => {
    console.log('Room not found!');
    alert('Không tìm thấy phòng! Vui lòng kiểm tra lại Room ID.');
    waitingLayer.style.display = 'none';
    lobbyLayer.style.display = 'flex';
    window.roomId = null;
    roomIdInput.value = '';
});

socket.on('hostChanged', (data) => {
    const { hostId } = data;
    window.isHost = hostId === window.playerId;
    // Nếu đang ở phòng chờ và đủ 2 người, hiển thị nút Start cho host mới
    const countText = playerCountText.textContent || '0/2';
    const count = parseInt(countText.split('/')[0], 10) || 0;
    if (waitingLayer.style.display !== 'none' && count === 2) {
        startGameBtn.style.display = window.isHost ? 'block' : 'none';
    }
});

// Khi host rời phòng, kick tất cả thành viên về lobby
socket.on('hostLeft', () => {
    alert('Chủ phòng đã rời! Quay về màn hình chính.');
    waitingLayer.style.display = 'none';
    gameOverLayer.style.display = 'none';
    lobbyLayer.style.display = 'flex';
    window.roomId = null;
    roomIdInput.value = '';
    if (typeof window.stopRenderLoop === 'function') {
        window.stopRenderLoop();
    }
    window.gameState = null;
});

socket.on('joined', (data) => {
    window.playerId = data.playerId;
    window.isP1 = data.isP1;
});

socket.on('gameState', (gameState) => {
    window.gameState = gameState;
    // Ẩn phòng chờ khi bắt đầu chơi
    waitingLayer.style.display = 'none';
    window.initGame();
});

// Đảm bảo initGame được gọi ngay khi server báo start game
socket.on('gameStarted', () => {
    if (window.gameState) {
        window.initGame();
    }
});

socket.on('updateState', (gameState) => {
    window.gameState = gameState;
    // XÓA window.renderGame() vì renderGame đang chạy trong vòng lặp requestAnimationFrame bên Game.js
});

// Handler cho "Play Again" - khi server reset game
socket.on('gameReset', (gameState) => {
    console.log('Game reset received, restarting...');
    window.gameState = gameState;
    const gameOverLayer = document.getElementById('game-over-layer');
    gameOverLayer.style.display = 'none';
    // Khởi động game lại mà không cần reload
    window.initGame();
});

// Khi người chơi 2 từ chối chơi lại -> đưa cả 2 về lobby
socket.on('resetGameDeclined', () => {
    alert('Người chơi 2 không đồng ý chơi lại. Quay về màn hình chính.');
    const gameOverLayer = document.getElementById('game-over-layer');
    gameOverLayer.style.display = 'none';
    waitingLayer.style.display = 'none';
    lobbyLayer.style.display = 'flex';
    window.roomId = null;
    roomIdInput.value = '';
    if (typeof window.stopRenderLoop === 'function') {
        window.stopRenderLoop();
    }
    window.gameState = null;
});

// Handler khi host yêu cầu chơi lại (dành cho player 2)
socket.on('resetGameRequest', () => {
    console.log('[Client] Received resetGameRequest from host');

    // Nếu đã có dialog thì không tạo lại
    if (document.getElementById('reset-game-dialog')) return;

    const overlay = document.createElement('div');
    overlay.id = 'reset-game-dialog';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.background = 'rgba(0, 0, 0, 0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '9999';

    const box = document.createElement('div');
    box.style.background = '#111';
    box.style.color = '#fff';
    box.style.padding = '20px 24px';
    box.style.borderRadius = '10px';
    box.style.textAlign = 'center';
    box.style.minWidth = '280px';
    box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.4)';

    const text = document.createElement('div');
    text.textContent = 'Người chơi 1 muốn chơi lại. Bạn có đồng ý không?';
    text.style.marginBottom = '16px';

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '10px';
    btnRow.style.justifyContent = 'center';

    const yesBtn = document.createElement('button');
    yesBtn.textContent = 'Đồng ý';
    yesBtn.className = 'primary-btn';

    const noBtn = document.createElement('button');
    noBtn.textContent = 'Từ chối';
    noBtn.className = 'secondary-btn';

    const sendResponse = (accept) => {
        if (window.socket && window.roomId) {
            socket.emit('respondResetGame', {
                roomId: window.roomId,
                accept
            });
            console.log('[Client] Sent respondResetGame to server, accept:', accept);
        }
        overlay.remove();
    };

    yesBtn.addEventListener('click', () => sendResponse(true));
    noBtn.addEventListener('click', () => sendResponse(false));

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    box.appendChild(text);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
});

// Loading flow: images -> sounds -> show lobby
function setLoading(percent, text) {
    loadingProgressBar.style.width = `${percent}%`;
    loadingText.textContent = text;
}

function startLoading() {
    loadingLayer.style.display = 'flex';
    lobbyLayer.style.display = 'none';

    // Load images (0% -> 50%)
    setLoading(0, 'Đang tải hình ảnh (0%)');
    window.loadImages(() => {
        setLoading(50, 'Đã tải hình ảnh xong (50%)');
        // Load sounds (50% -> 100%)
        const am = new AudioManager();
        window.audioManager = am;
        const soundSources = {
            shoot: 'sounds/shoot.mp3',
            pickup: 'sounds/pickup.mp3',
            bgmusic: 'sounds/bgmusic.mp3'
        };
        am.loadSounds(soundSources, (loaded, total) => {
            const pct = 50 + Math.floor((loaded / total) * 50);
            setLoading(pct, `Đang tải âm thanh (${pct}%)`);
        }, () => {
            setLoading(100, 'Hoàn tất!');
            // Small delay for UX
            setTimeout(() => {
                loadingLayer.style.display = 'none';
                lobbyLayer.style.display = 'flex';
                window.initUI();
            }, 200);
        });
    }, (loaded, total) => {
        const pct = Math.floor((loaded / total) * 50);
        setLoading(pct, `Đang tải hình ảnh (${pct}%)`);
    });
}

// Kick off loading on page load
startLoading();

// Controls: dùng giá trị mặc định cho mỗi lần tải trang
// (không lưu vào localStorage để mỗi lần mở lại sẽ reset về WASD + Space)