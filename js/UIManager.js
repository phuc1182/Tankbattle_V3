// UIManager.js - Quản lý UI và menu

function initUI() {
    const lobbyLayer = document.getElementById('lobby-layer');
    const settingsLayer = document.getElementById('settings-layer');
    const gameOverLayer = document.getElementById('game-over-layer');
    const settingsBtn = document.getElementById('settingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const backToLobbyBtn = document.getElementById('backToLobbyBtn');
    const restartBtn = document.getElementById('restartBtn');
    const homeBtn = document.getElementById('homeBtn');

    // Load controls cho session hiện tại (không dùng localStorage)
    loadControls();

    // NÚT MỞ SETTINGS
    settingsBtn.addEventListener('click', () => {
        lobbyLayer.style.display = 'none';
        settingsLayer.style.display = 'flex';
    });

    // NÚT LƯU CÀI ĐẶT
    saveSettingsBtn.addEventListener('click', () => {
        saveControls();
        alert('Đã lưu cài đặt phím!');
        settingsLayer.style.display = 'none';
        lobbyLayer.style.display = 'flex';
    });

    // NÚT QUAY LẠI TỪ SETTINGS
    backToLobbyBtn.addEventListener('click', () => {
        settingsLayer.style.display = 'none';
        lobbyLayer.style.display = 'flex';
    });

    // NÚT CHƠI LẠI: Disconnect và quay về lobby
    restartBtn.addEventListener('click', () => {
        gameOverLayer.style.display = 'none';
        // Disconnect khỏi room hiện tại
        if (window.socket) {
            window.socket.emit('leaveGame');
        }
        // Reload trang để quay về lobby
        location.reload();
    });

    // NÚT MÀN HÌNH CHÍNH: Quay về lobby
    homeBtn.addEventListener('click', () => {
        gameOverLayer.style.display = 'none';
        if (window.socket) {
            window.socket.emit('leaveGame');
        }
        location.reload();
    });
}

// Hàm load controls cho session hiện tại (reset về mặc định khi reload)
function loadControls() {
    const controls = window.controlsP1 || { up: 'w', down: 's', left: 'a', right: 'd', shoot: ' ' };
    document.getElementById('control-up').value = controls.up;
    document.getElementById('control-down').value = controls.down;
    document.getElementById('control-left').value = controls.left;
    document.getElementById('control-right').value = controls.right;
    document.getElementById('control-shoot').value = controls.shoot;
    window.controlsP1 = controls; // giữ trong RAM cho tới khi refresh
}

// Hàm save controls cho session hiện tại (không lưu localStorage)
function saveControls() {
    const controls = {
        up: document.getElementById('control-up').value,
        down: document.getElementById('control-down').value,
        left: document.getElementById('control-left').value,
        right: document.getElementById('control-right').value,
        shoot: document.getElementById('control-shoot').value
    };
    window.controlsP1 = controls;
}

// Global
window.initUI = initUI;
window.loadControls = loadControls;
window.saveControls = saveControls;