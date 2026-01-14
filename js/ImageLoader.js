// ImageLoader.js - Quản lý hình ảnh
const IMAGES = {}; // Biến chứa tất cả ảnh đã load

function loadImages(doneCb, progressCb) {
    const sources = {
        tank1: 'images/tank1.png',
        tank2: 'images/tank2.png',
        wall:  'images/wall.png',
        bg:    'images/bg.png',
        bullet:'images/bullet.png'
    };

    const keys = Object.keys(sources);
    const total = keys.length;
    let loaded = 0;

    keys.forEach((key) => {
        IMAGES[key] = new Image();
        IMAGES[key].src = sources[key];
        IMAGES[key].onload = () => {
            loaded++;
            if (typeof progressCb === 'function') {
                progressCb(loaded, total);
            }
            if (loaded === total && typeof doneCb === 'function') {
                doneCb();
            }
        };
        IMAGES[key].onerror = () => {
            // Vẫn tăng để không kẹt loading nếu ảnh lỗi
            loaded++;
            if (typeof progressCb === 'function') {
                progressCb(loaded, total);
            }
            if (loaded === total && typeof doneCb === 'function') {
                doneCb();
            }
        };
    });
}

// Global
window.IMAGES = IMAGES;
window.loadImages = loadImages;