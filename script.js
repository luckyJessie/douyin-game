// 游戏状态管理
class GameState {
    constructor() {
        this.isPlaying = false;
        this.isPaused = false;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameSpeed = 2000; // 水果生成间隔（毫秒）
        this.fruitSpeed = 3; // 水果下落速度
        this.gameLoop = null;
        this.fruitSpawnLoop = null;
    }

    reset() {
        this.isPlaying = false;
        this.isPaused = false;
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.gameSpeed = 2000;
        this.fruitSpeed = 3;
    }
}

// 游戏主类
class FruitCatchGame {
    constructor() {
        this.gameState = new GameState();
        this.basket = null;
        this.fruits = [];
        this.particles = [];
        
        // DOM元素
        this.elements = {
            startScreen: document.getElementById('startScreen'),
            gameScreen: document.getElementById('gameScreen'),
            gameOverScreen: document.getElementById('gameOverScreen'),
            pauseScreen: document.getElementById('pauseScreen'),
            startBtn: document.getElementById('startBtn'),
            restartBtn: document.getElementById('restartBtn'),
            restartBtn2: document.getElementById('restartBtn2'),
            resumeBtn: document.getElementById('resumeBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            basket: document.getElementById('basket'),
            fruitsContainer: document.getElementById('fruitsContainer'),
            particlesContainer: document.getElementById('particlesContainer'),
            score: document.getElementById('score'),
            lives: document.getElementById('lives'),
            level: document.getElementById('level'),
            finalScore: document.getElementById('finalScore'),
            finalLevel: document.getElementById('finalLevel')
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUI();
    }

    bindEvents() {
        // 开始游戏
        this.elements.startBtn.addEventListener('click', () => this.startGame());
        this.elements.restartBtn.addEventListener('click', () => this.restartGame());
        this.elements.restartBtn2.addEventListener('click', () => this.restartGame());
        this.elements.resumeBtn.addEventListener('click', () => this.resumeGame());
        this.elements.pauseBtn.addEventListener('click', () => this.pauseGame());

        // 鼠标/触摸控制篮子
        this.elements.gameScreen.addEventListener('mousemove', (e) => this.moveBasket(e));
        this.elements.gameScreen.addEventListener('touchmove', (e) => this.moveBasket(e.touches[0]));

        // 点击水果
        this.elements.fruitsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('fruit')) {
                this.catchFruit(e.target);
            }
        });

        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameState.isPlaying && !this.gameState.isPaused) {
                    this.pauseGame();
                } else if (this.gameState.isPaused) {
                    this.resumeGame();
                }
            }
        });
    }

    startGame() {
        this.gameState.reset();
        this.gameState.isPlaying = true;
        this.showScreen('gameScreen');
        this.startGameLoop();
        this.updateUI();
    }

    restartGame() {
        this.endGame();
        this.startGame();
    }

    pauseGame() {
        if (!this.gameState.isPlaying) return;
        
        this.gameState.isPaused = true;
        this.showScreen('pauseScreen');
        clearInterval(this.gameLoop);
        clearInterval(this.fruitSpawnLoop);
    }

    resumeGame() {
        if (!this.gameState.isPlaying) return;
        
        this.gameState.isPaused = false;
        this.showScreen('gameScreen');
        this.startGameLoop();
    }

    endGame() {
        this.gameState.isPlaying = false;
        this.gameState.isPaused = false;
        clearInterval(this.gameLoop);
        clearInterval(this.fruitSpawnLoop);
        
        // 清理所有水果
        this.elements.fruitsContainer.innerHTML = '';
        this.fruits = [];
        
        // 显示游戏结束界面
        this.elements.finalScore.textContent = this.gameState.score;
        this.elements.finalLevel.textContent = this.gameState.level;
        this.showScreen('gameOverScreen');
    }

    startGameLoop() {
        // 生成水果
        this.fruitSpawnLoop = setInterval(() => {
            if (this.gameState.isPlaying && !this.gameState.isPaused) {
                this.spawnFruit();
            }
        }, this.gameState.gameSpeed);

        // 游戏主循环
        this.gameLoop = setInterval(() => {
            if (this.gameState.isPlaying && !this.gameState.isPaused) {
                this.updateGame();
            }
        }, 16); // 60 FPS
    }

    spawnFruit() {
        const fruitTypes = ['apple', 'banana', 'orange', 'grape', 'strawberry'];
        const fruitType = fruitTypes[Math.floor(Math.random() * fruitTypes.length)];
        
        const fruit = document.createElement('div');
        fruit.className = `fruit ${fruitType}`;
        fruit.innerHTML = this.getFruitEmoji(fruitType);
        
        // 随机水平位置
        const x = Math.random() * (window.innerWidth - 40);
        fruit.style.left = x + 'px';
        fruit.style.top = '-40px';
        
        // 设置下落动画
        const fallTime = (window.innerHeight + 40) / this.gameState.fruitSpeed;
        fruit.style.animationDuration = fallTime + 's';
        
        this.elements.fruitsContainer.appendChild(fruit);
        this.fruits.push(fruit);
        
        // 水果落地检测
        setTimeout(() => {
            if (fruit.parentNode) {
                this.missFruit(fruit);
            }
        }, fallTime * 1000);
    }

    getFruitEmoji(type) {
        const emojis = {
            apple: '🍎',
            banana: '🍌',
            orange: '🍊',
            grape: '🍇',
            strawberry: '🍓'
        };
        return emojis[type] || '🍎';
    }

    moveBasket(e) {
        if (!this.gameState.isPlaying || this.gameState.isPaused) return;
        
        const basket = this.elements.basket;
        const rect = this.elements.gameScreen.getBoundingClientRect();
        const x = e.clientX - rect.left - basket.offsetWidth / 2;
        const maxX = rect.width - basket.offsetWidth;
        
        basket.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    }

    catchFruit(fruit) {
        if (!this.gameState.isPlaying || this.gameState.isPaused) return;
        
        // 检查是否在篮子范围内
        const basketRect = this.elements.basket.getBoundingClientRect();
        const fruitRect = fruit.getBoundingClientRect();
        
        const basketCenter = basketRect.left + basketRect.width / 2;
        const fruitCenter = fruitRect.left + fruitRect.width / 2;
        const distance = Math.abs(basketCenter - fruitCenter);
        
        if (distance < basketRect.width / 2 + fruitRect.width / 2) {
            this.addScore(fruit);
            this.createParticles(fruitRect.left + fruitRect.width / 2, fruitRect.top + fruitRect.height / 2);
            this.removeFruit(fruit);
        }
    }

    missFruit(fruit) {
        if (fruit.parentNode) {
            this.loseLife();
            this.removeFruit(fruit);
        }
    }

    addScore(fruit) {
        const points = this.getFruitPoints(fruit.className);
        this.gameState.score += points;
        
        // 得分动画
        this.elements.score.classList.add('score-pop');
        setTimeout(() => {
            this.elements.score.classList.remove('score-pop');
        }, 500);
        
        this.updateUI();
        this.checkLevelUp();
    }

    getFruitPoints(className) {
        const points = {
            'fruit apple': 10,
            'fruit banana': 15,
            'fruit orange': 12,
            'fruit grape': 20,
            'fruit strawberry': 25
        };
        return points[className] || 10;
    }

    loseLife() {
        this.gameState.lives--;
        this.updateUI();
        
        if (this.gameState.lives <= 0) {
            this.endGame();
        }
    }

    checkLevelUp() {
        const newLevel = Math.floor(this.gameState.score / 100) + 1;
        if (newLevel > this.gameState.level) {
            this.gameState.level = newLevel;
            this.gameState.gameSpeed = Math.max(500, 2000 - (newLevel - 1) * 200);
            this.gameState.fruitSpeed = Math.min(8, 3 + (newLevel - 1) * 0.5);
            this.updateUI();
        }
    }

    removeFruit(fruit) {
        const index = this.fruits.indexOf(fruit);
        if (index > -1) {
            this.fruits.splice(index, 1);
        }
        if (fruit.parentNode) {
            fruit.parentNode.removeChild(fruit);
        }
    }

    createParticles(x, y) {
        for (let i = 0; i < 8; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            
            // 随机方向
            const angle = (Math.PI * 2 * i) / 8;
            const velocity = 50 + Math.random() * 50;
            const vx = Math.cos(angle) * velocity;
            const vy = Math.sin(angle) * velocity;
            
            particle.style.setProperty('--vx', vx + 'px');
            particle.style.setProperty('--vy', vy + 'px');
            
            this.elements.particlesContainer.appendChild(particle);
            
            // 移除粒子
            setTimeout(() => {
                if (particle.parentNode) {
                    particle.parentNode.removeChild(particle);
                }
            }, 1000);
        }
    }

    updateGame() {
        // 更新水果位置
        this.fruits.forEach(fruit => {
            const rect = fruit.getBoundingClientRect();
            if (rect.top > window.innerHeight) {
                this.missFruit(fruit);
            }
        });
    }

    updateUI() {
        this.elements.score.textContent = this.gameState.score;
        this.elements.lives.textContent = this.gameState.lives;
        this.elements.level.textContent = this.gameState.level;
    }

    showScreen(screenName) {
        const screens = ['startScreen', 'gameScreen', 'gameOverScreen', 'pauseScreen'];
        screens.forEach(screen => {
            this.elements[screen].style.display = screen === screenName ? 'block' : 'none';
        });
    }
}

// 音效管理（简单版本，使用Web Audio API）
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.init();
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }

    playSound(frequency, duration, type = 'sine') {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    playCatchSound() {
        this.playSound(800, 0.1, 'square');
    }

    playMissSound() {
        this.playSound(200, 0.3, 'sawtooth');
    }

    playLevelUpSound() {
        this.playSound(600, 0.2, 'sine');
        setTimeout(() => this.playSound(800, 0.2, 'sine'), 100);
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    const game = new FruitCatchGame();
    const soundManager = new SoundManager();
    
    // 将音效管理器添加到游戏实例中
    game.soundManager = soundManager;
    
    // 重写游戏方法以包含音效
    const originalCatchFruit = game.catchFruit.bind(game);
    game.catchFruit = function(fruit) {
        const result = originalCatchFruit(fruit);
        if (result !== false) {
            soundManager.playCatchSound();
        }
        return result;
    };
    
    const originalLoseLife = game.loseLife.bind(game);
    game.loseLife = function() {
        originalLoseLife();
        soundManager.playMissSound();
    };
    
    const originalCheckLevelUp = game.checkLevelUp.bind(game);
    game.checkLevelUp = function() {
        const oldLevel = game.gameState.level;
        originalCheckLevelUp();
        if (game.gameState.level > oldLevel) {
            soundManager.playLevelUpSound();
        }
    };
    
    // 触摸设备优化
    if ('ontouchstart' in window) {
        document.body.classList.add('touch-device');
    }
    
    // 防止页面滚动
    document.addEventListener('touchmove', (e) => {
        if (game.gameState.isPlaying) {
            e.preventDefault();
        }
    }, { passive: false });
});