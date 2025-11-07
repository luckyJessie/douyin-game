const { createAI } = require('../../utils/ai');

const BOARD_SIZE = 15;
const HUMAN_ROLE = 1;
const AI_ROLE = -1;

function createEmptyBoard(size) {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

Page({
  data: {
    statusText: '准备开始，点击棋盘落子',
    playerFirst: true,
    gameOver: false,
    canUndo: false,
    aiThinking: false,
    difficultyIndex: 1,
    difficulties: [
      { label: '入门', depth: 1, timeLimit: 600 },
      { label: '标准', depth: 2, timeLimit: 1200 },
      { label: '高手', depth: 3, timeLimit: 1800 }
    ],
    difficultyLabels: ['入门', '标准', '高手'],
    steps: [],
    canvasPixelSize: 600
  },

  onLoad() {
    this.ai = createAI({ boardSize: BOARD_SIZE });
    this.humanRole = HUMAN_ROLE;
    this.aiRole = AI_ROLE;
    this.pixelRatio = 1;
    this.board = createEmptyBoard(BOARD_SIZE);
    this.currentRole = this.data.playerFirst ? this.humanRole : this.aiRole;
    this.stepsStack = [];
  },

  onReady() {
    this.setupCanvas().then(() => {
      this.resetGame({ triggerAI: !this.data.playerFirst });
    });
  },

  setupCanvas() {
    return new Promise((resolve) => {
      const query = wx.createSelectorQuery();
      query
        .in(this)
        .select('.board')
        .boundingClientRect((rect) => {
          const fallbackSize = 600;
          this.canvasSize = rect && rect.width ? rect.width : fallbackSize;
          const systemInfo = wx.getSystemInfoSync();
          this.pixelRatio = systemInfo.pixelRatio || 1;
          const canvasPixelSize = Math.max(
            Math.floor(this.canvasSize * this.pixelRatio),
            Math.floor(this.canvasSize)
          );
          this.setData({
            canvasPixelSize
          });
          this.ctx = wx.createCanvasContext('board', this);
          if (this.pixelRatio !== 1) {
            this.ctx.scale(this.pixelRatio, this.pixelRatio);
          }
          this.padding = this.canvasSize * 0.05;
          this.gridGap = (this.canvasSize - this.padding * 2) / (BOARD_SIZE - 1);
          this.stoneRadius = this.gridGap * 0.42;
          resolve();
        })
        .exec();
    });
  },

  resetGame({ triggerAI = false } = {}) {
    this.board = createEmptyBoard(BOARD_SIZE);
    this.stepsStack = [];
    this.currentRole = this.data.playerFirst ? this.humanRole : this.aiRole;
    const status = this.data.playerFirst ? '你先手，请落子' : '电脑先手，请稍候';
    this.setData({
      statusText: status,
      gameOver: false,
      canUndo: false,
      aiThinking: triggerAI,
      steps: []
    });
    this.renderBoard();
    if (triggerAI) {
      this.deferAiMove();
    }
  },

  renderBoard() {
    if (!this.ctx) {
      return;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);

    ctx.save();
    ctx.setFillStyle('#f4d79e');
    ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);
    ctx.restore();

    const lineWidth = this.pixelRatio ? 1 / this.pixelRatio : 1;
    ctx.setStrokeStyle('#b98952');
    ctx.setLineWidth(lineWidth);
    for (let i = 0; i < BOARD_SIZE; i += 1) {
      const pos = this.padding + i * this.gridGap;
      ctx.beginPath();
      ctx.moveTo(this.padding, pos);
      ctx.lineTo(this.canvasSize - this.padding, pos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos, this.padding);
      ctx.lineTo(pos, this.canvasSize - this.padding);
      ctx.stroke();
    }

    const starPoints = [
      [3, 3],
      [3, 11],
      [7, 7],
      [11, 3],
      [11, 11]
    ];
    ctx.setFillStyle('#4a3423');
    starPoints.forEach(([sx, sy]) => {
      const cx = this.padding + sx * this.gridGap;
      const cy = this.padding + sy * this.gridGap;
      ctx.beginPath();
      ctx.arc(cx, cy, this.gridGap * 0.12, 0, Math.PI * 2);
      ctx.fill();
    });

    for (let x = 0; x < BOARD_SIZE; x += 1) {
      for (let y = 0; y < BOARD_SIZE; y += 1) {
        const role = this.board[x][y];
        if (!role) {
          continue;
        }
        this.drawStone(x, y, role);
      }
    }

    const last = this.stepsStack[this.stepsStack.length - 1];
    if (last) {
      const cx = this.padding + last.x * this.gridGap;
      const cy = this.padding + last.y * this.gridGap;
      ctx.save();
      ctx.beginPath();
      ctx.setStrokeStyle('#ff7f50');
      const highlightWidth = this.pixelRatio ? 2 / this.pixelRatio : 2;
      ctx.setLineWidth(highlightWidth);
      ctx.arc(cx, cy, this.gridGap * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.draw();
  },

  drawStone(x, y, role) {
    const ctx = this.ctx;
    const cx = this.padding + x * this.gridGap;
    const cy = this.padding + y * this.gridGap;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, this.stoneRadius, 0, Math.PI * 2);
    if (role === this.humanRole) {
      ctx.setFillStyle('#2f2f2f');
      ctx.setShadow(2, 3, 6, 'rgba(0,0,0,0.35)');
    } else {
      ctx.setFillStyle('#f7f7f7');
      const outlineWidth = this.pixelRatio ? 1 / this.pixelRatio : 1;
      ctx.setStrokeStyle('#d8d8d8');
      ctx.setLineWidth(outlineWidth);
      ctx.setShadow(2, 3, 6, 'rgba(0,0,0,0.25)');
    }
    ctx.fill();
    if (role === this.aiRole) {
      ctx.stroke();
    }
    ctx.restore();
  },

  handleTap(event) {
    if (this.data.gameOver || this.data.aiThinking || this.currentRole !== this.humanRole) {
      return;
    }
    const touch = event.touches && event.touches[0];
    if (!touch) {
      return;
    }
    const point = this.locateBoardPoint(touch.x, touch.y);
    if (!point) {
      return;
    }
    const { x, y } = point;
    if (this.board[x][y] !== 0) {
      return;
    }
    this.placeStone(x, y, this.humanRole);
    const finished = this.checkGameOver({ x, y });
    if (finished) {
      return;
    }
    this.currentRole = this.aiRole;
    this.setData({
      statusText: '电脑思考中...',
      aiThinking: true
    });
    this.deferAiMove();
  },

  placeStone(x, y, role) {
    this.board[x][y] = role;
    this.stepsStack.push({ x, y, role });
    this.setData({
      steps: this.stepsStack.slice(),
      canUndo: this.stepsStack.length > 0
    });
    this.renderBoard();
  },

  deferAiMove() {
    setTimeout(() => {
      this.aiMove();
    }, 60);
  },

  aiMove() {
    if (this.data.gameOver) {
      this.setData({ aiThinking: false });
      return;
    }
    const difficulty = this.data.difficulties[this.data.difficultyIndex];
    const { move } = this.ai.findBestMove(this.board, this.aiRole, this.humanRole, {
      depth: difficulty.depth + (this.stepsStack.length < 6 ? 1 : 0),
      timeLimit: difficulty.timeLimit
    });
    if (!move) {
      this.finishDraw();
      return;
    }
    this.placeStone(move.x, move.y, this.aiRole);
    const finished = this.checkGameOver(move);
    if (finished) {
      return;
    }
    this.currentRole = this.humanRole;
    this.setData({
      statusText: '轮到你了',
      aiThinking: false
    });
  },

  finishDraw() {
    this.setData({
      statusText: '平局',
      gameOver: true,
      aiThinking: false
    });
  },

  checkGameOver(move) {
    const winner = this.ai.checkWinner(this.board, move);
    if (winner === this.humanRole) {
      this.setData({
        statusText: '恭喜，你赢了！',
        gameOver: true,
        aiThinking: false
      });
      return true;
    }
    if (winner === this.aiRole) {
      this.setData({
        statusText: '电脑获胜，再试一次吧',
        gameOver: true,
        aiThinking: false
      });
      return true;
    }
    if (this.isBoardFull()) {
      this.finishDraw();
      return true;
    }
    return false;
  },

  isBoardFull() {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      for (let y = 0; y < BOARD_SIZE; y += 1) {
        if (this.board[x][y] === 0) {
          return false;
        }
      }
    }
    return true;
  },

  locateBoardPoint(touchX, touchY) {
    const offsetX = touchX - this.padding;
    const offsetY = touchY - this.padding;
    const col = Math.round(offsetX / this.gridGap);
    const row = Math.round(offsetY / this.gridGap);
    if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) {
      return null;
    }
    const nearestX = this.padding + col * this.gridGap;
    const nearestY = this.padding + row * this.gridGap;
    const distance = Math.sqrt((nearestX - touchX) ** 2 + (nearestY - touchY) ** 2);
    if (distance > this.gridGap * 0.5) {
      return null;
    }
    return { x: col, y: row };
  },

  handleRestart() {
    this.resetGame({ triggerAI: !this.data.playerFirst });
  },

  handleUndo() {
    if (this.data.aiThinking || this.stepsStack.length === 0) {
      return;
    }
    const last = this.stepsStack.pop();
    if (last) {
      this.board[last.x][last.y] = 0;
    }
    const second = this.stepsStack.pop();
    if (second) {
      this.board[second.x][second.y] = 0;
    }
    this.currentRole = this.humanRole;
    this.setData({
      steps: this.stepsStack.slice(),
      canUndo: this.stepsStack.length > 0,
      aiThinking: false,
      statusText: '轮到你了',
      gameOver: false
    });
    this.renderBoard();
  },

  toggleFirst() {
    if (!this.data.gameOver && this.stepsStack.length > 0) {
      return;
    }
    const next = !this.data.playerFirst;
    this.setData(
      {
        playerFirst: next
      },
      () => {
        this.resetGame({ triggerAI: !next });
      }
    );
  },

  handleDifficultyChange(event) {
    const index = Number(event.detail.value);
    if (Number.isNaN(index)) {
      return;
    }
    const label = this.data.difficultyLabels[index];
    this.setData({
      difficultyIndex: index
    });
    wx.showToast({
      title: `已切换到${label}模式`,
      icon: 'none',
      duration: 800
    });
  }
});
