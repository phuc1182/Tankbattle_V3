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

// Create room
createRoomBtn.addEventListener('click', () => {
    const roomId = Math.random().toString(36).substr(2, 8).toUpperCase();
    socket.emit('createRoom', { roomId });
    window.roomId = roomId;
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
    if (data.playerCount === 2) {
        document.querySelector('.waiting-msg').textContent = 'Đủ người chơi! Đang chờ host bắt đầu...';
    }
});
socket.on('playerJoined', (data) => {
    playerCountText.textContent = data.playerCount + '/2';
    if (data.playerCount === 2 && window.isP1) {
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

socket.on('gameStarted', () => {
    waitingLayer.style.display = 'none';
});

socket.on('joined', (data) => {
    window.playerId = data.playerId;
    window.isP1 = data.isP1;
});

socket.on('gameState', (gameState) => {
    window.gameState = gameState;
    window.initGame();
});

socket.on('updateState', (gameState) => {
    window.gameState = gameState;
    // XÓA window.renderGame() vì renderGame đang chạy trong vòng lặp requestAnimationFrame bên Game.js
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