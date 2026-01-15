class AudioManager {
    constructor() {
        this.sounds = {};        // {name: Audio instance}
        this.soundInstances = {}; // {name: [Audio instances]} - cho overlapping
        this.music = null;
        
        // === AUDIO OVERLAPPING CONFIG ===
        // Default dùng pooling để tránh tạo Audio liên tục (ngăn leak)
        this.overlapMethod = 'pool'; // 'pool' | 'clone'
        
        // Cho pooling method: số instance pool mỗi sound
        this.soundPoolSize = 5; // 5 instance cho mỗi sound
        this.soundPools = {}; // {name: [pool of Audio instances]}
        
        // Tracking: âm thanh đang phát (để cleanup)
        this.activeSounds = []; // Array các Audio instance đang phát
    }

    loadSound(name, src) {
        // Tạo master Audio instance
        this.sounds[name] = new Audio(src);
        
        // === INIT SOUND POOLING ===
        // Nếu dùng pool method, tạo sẵn pool
        if (this.overlapMethod === 'pool') {
            this.soundPools[name] = [];
            for (let i = 0; i < this.soundPoolSize; i++) {
                const audio = new Audio(src);
                audio.preload = 'auto';
                this.soundPools[name].push(audio);
            }
        }
        
        // Init soundInstances array
        this.soundInstances[name] = [];
    }

    /**
     * Phát âm thanh với hỗ trợ overlapping
     * @param {string} name - Tên âm thanh
     * @param {boolean} loop - Có lặp lại không
     * @param {boolean} allowOverlap - Cho phép âm thanh chồng lên nhau (default: true cho shoot)
     */
    playSound(name, loop = false, allowOverlap = true) {
        if (!this.sounds[name]) return;

        // === PHƯƠNG PHÁP 1: CLONE NODE ===
        if (this.overlapMethod === 'clone' && allowOverlap) {
            try {
                // Clone audio node để phát song song
                const audioClone = this.sounds[name].cloneNode();
                audioClone.loop = loop;
                audioClone.volume = 1.0;
                
                // Phát âm thanh
                const playPromise = audioClone.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => console.warn(`Audio play failed: ${name}`, e));
                }
                
                // Cleanup sau khi âm thanh kết thúc
                if (!loop) {
                    const onEnded = () => {
                        audioClone.pause();
                        audioClone.currentTime = 0;
                        this.activeSounds = this.activeSounds.filter(s => s !== audioClone);
                    };
                    audioClone.addEventListener('ended', onEnded, { once: true });
                }
                
                // Track active sound
                this.activeSounds.push(audioClone);
                
                return audioClone;
            } catch (e) {
                console.warn(`Clone audio failed: ${name}`, e);
                // Fallback: phát âm thanh thường (cắt cũ)
                this._playSoundDefault(name, loop);
            }
        }
        // === PHƯƠNG PHÁP 2: SOUND POOLING ===
        else if (this.overlapMethod === 'pool' && allowOverlap && this.soundPools[name]) {
            const pool = this.soundPools[name];
            
            // Tìm audio instance đã kết thúc
            let audioToUse = null;
            for (let audio of pool) {
                if (audio.paused || audio.ended) {
                    audioToUse = audio;
                    break;
                }
            }
            
            // Nếu tất cả đang phát, tạo instance mới (fallback)
            if (!audioToUse) {
                audioToUse = new Audio(this.sounds[name].src);
                pool.push(audioToUse);
            }
            
            // Reset và phát
            audioToUse.currentTime = 0;
            audioToUse.loop = loop;
            audioToUse.volume = 1.0;
            
            const playPromise = audioToUse.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.warn(`Audio play failed: ${name}`, e));
            }
            
            return audioToUse;
        }
        // === DEFAULT: PHÁT THƯỜNG (CẮT CŨ) ===
        else {
            this._playSoundDefault(name, loop);
        }
    }

    /**
     * Phát âm thanh mặc định (cắt âm thanh cũ nếu đang phát)
     * @private
     */
    _playSoundDefault(name, loop) {
        if (this.sounds[name]) {
            const audio = this.sounds[name];
            audio.currentTime = 0;
            audio.loop = loop;
            
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {});
            }
            
            return audio;
        }
    }

    stopSound(name) {
        if (this.sounds[name]) {
            this.sounds[name].pause();
            this.sounds[name].currentTime = 0;
        }
        
        // Stop tất cả clones của sound này
        if (this.soundInstances[name]) {
            this.soundInstances[name].forEach(audio => {
                audio.pause();
                audio.currentTime = 0;
            });
            this.soundInstances[name] = [];
        }
    }

    /**
     * Dừng tất cả âm thanh đang phát
     */
    stopAllSounds() {
        // Stop master instances
        Object.values(this.sounds).forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        // Stop clone instances
        this.activeSounds.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.activeSounds = [];
        
        // Stop pool instances
        Object.values(this.soundPools).forEach(pool => {
            pool.forEach(audio => {
                audio.pause();
                audio.currentTime = 0;
            });
        });
    }

    playMusic(src) {
        if (this.music) {
            this.music.pause();
        }
        this.music = new Audio(src);
        this.music.loop = true;
        this.music.volume = 0.5; // Giảm âm lượng nhạc nền
        this.music.play().catch(e => {});
    }

    stopMusic() {
        if (this.music) {
            this.music.pause();
        }
    }

    /**
     * Thay đổi phương pháp xử lý overlapping
     * @param {string} method - 'clone' hoặc 'pool'
     */
    setOverlapMethod(method) {
        if (method === 'clone' || method === 'pool') {
            this.overlapMethod = method;
            console.log(`Audio overlap method changed to: ${method}`);
        } else {
            console.warn(`Invalid overlap method: ${method}`);
        }
    }

    /**
     * Lấy thông tin về âm thanh đang phát
     */
    getAudioStats() {
        const activeSoundCount = this.activeSounds.filter(s => !s.paused && !s.ended).length;
        const totalPoolSize = Object.values(this.soundPools).reduce((sum, pool) => sum + pool.length, 0);
        
        return {
            method: this.overlapMethod,
            activeSoundCount,
            totalPoolSize,
            activeSoundInstances: this.activeSounds.length
        };
    }

    // Batch load sounds with progress
    loadSounds(sources, progressCb, doneCb) {
        const keys = Object.keys(sources);
        const total = keys.length;
        if (total === 0) {
            if (typeof doneCb === 'function') doneCb();
            return;
        }
        let loaded = 0;
        keys.forEach((key) => {
            const audio = new Audio(sources[key]);
            const onDone = () => {
                loaded++;
                this.sounds[key] = audio;
                
                // Init sound instances array
                this.soundInstances[key] = [];
                
                // Init pooling nếu dùng pool method
                if (this.overlapMethod === 'pool') {
                    this.soundPools[key] = [];
                    for (let i = 0; i < this.soundPoolSize; i++) {
                        const poolAudio = new Audio(sources[key]);
                        poolAudio.preload = 'auto';
                        this.soundPools[key].push(poolAudio);
                    }
                }
                
                if (typeof progressCb === 'function') progressCb(loaded, total);
                if (loaded === total && typeof doneCb === 'function') doneCb();
                audio.removeEventListener('canplaythrough', onDone);
                audio.removeEventListener('error', onDone);
            };
            audio.addEventListener('canplaythrough', onDone, { once: true });
            audio.addEventListener('error', onDone, { once: true });
            // Trigger load
            audio.load();
        });
    }
}