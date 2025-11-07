const { createBeanSproutAI } = require('../../utils/beanSproutAI.js');

const BOARD_SIZE = 15;
const HUMAN_PLAYER = 1;
const AI_PLAYER = 2;

Page({
  data: {
    boardSize: BOARD_SIZE,
    moveCount: 0,
    statusMessage: '玩家执黑先行',
    isHumanTurn: true,
    gameOver: false
  },

  onLoad() {
    this.ai = createBeanSproutAI({
      boardSize: BOARD_SIZE,
      maxDepth: 3,
      maxCandidates: 10,
      timeLimit: 1500
    });
    this.firstPlayer = HUMAN_PLAYER;
    this.board = this._createEmptyBoard();
    this.lastMove = null;
    this.aiThinking = false;
  },

  onReady() {
    this._initCanvas();
  },

  _initCanvas() {
    const query = wx.createSelectorQuery();
    query
      .select('#boardCanvas')
      .fields({ node: true, size: true })
      .exec(res => {
        if (!res || !res[0]) {
          console.error('无法初始化画布');
          return;
        }
        const canvasInfo = res[0];
        this.canvas = canvasInfo.node;
        this.ctx = this.canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio || 1;
        this.canvasWidth = canvasInfo.width;
        this.canvasHeight = canvasInfo.height;
        this.canvas.width = canvasInfo.width * dpr;
        this.canvas.height = canvasInfo.height * dpr;
        this.ctx.scale(dpr, dpr);

        this.gridPadding = this.canvasWidth * 0.06;
        this.gridSize =
          (this.canvasWidth - this.gridPadding * 2) / (BOARD_SIZE - 1);

        this.resetGame();
      });
  },

  _createEmptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () =>
      Array.from({ length: BOARD_SIZE }, () => 0)
    );
  },

  resetGame() {
    if (!this.ctx) {
      return;
    }
    this.board = this._createEmptyBoard();
    this.lastMove = null;
    this.aiThinking = false;
    this.ai.reset();

    const humanFirst = this.firstPlayer === HUMAN_PLAYER;
    this.setData({
      moveCount: 0,
      isHumanTurn: humanFirst,
      gameOver: false,
      statusMessage: humanFirst ? '玩家执黑先行' : 'AI执黑先行'
    });

    this._drawBoard();

    if (!humanFirst) {
      this._scheduleAIMove();
    }
  },

  switchFirstPlayer() {
    this.firstPlayer =
      this.firstPlayer === HUMAN_PLAYER ? AI_PLAYER : HUMAN_PLAYER;
    const hint =
      this.firstPlayer === HUMAN_PLAYER ? '玩家将执黑先手' : 'AI 将执黑先手';
    wx.showToast({
      title: hint,
      icon: 'none',
      duration: 1200
    });
    this.resetGame();
  },

  handleTouchStart(event) {
    if (
      this.data.gameOver ||
      !this.data.isHumanTurn ||
      this.aiThinking ||
      !event.touches.length
    ) {
      return;
    }

    const { x, y } = event.touches[0];
    const { row, col } = this._locateCell(x, y);
    if (row < 0 || col < 0) {
      return;
    }
    if (this.board[row][col] !== 0) {
      return;
    }

    this._placeStone(row, col, HUMAN_PLAYER);
    const victory = this._checkVictory(row, col, HUMAN_PLAYER);
    const moveCount = this.data.moveCount + 1;
    this.setData({
      moveCount
    });

    if (victory) {
      this.setData({
        statusMessage: '恭喜！玩家连成五子获胜',
        gameOver: true,
        isHumanTurn: false
      });
      return;
    }

    if (moveCount >= BOARD_SIZE * BOARD_SIZE) {
      this.setData({
        statusMessage: '棋盘落满，双方和棋',
        gameOver: true,
        isHumanTurn: false
      });
      return;
    }

    this.setData({
      isHumanTurn: false,
      statusMessage: 'AI 思考中…'
    });
    this._scheduleAIMove();
  },

  _scheduleAIMove() {
    this.aiThinking = true;
    setTimeout(() => {
      this._makeAIMove();
    }, 60);
  },

  _makeAIMove() {
    const start = Date.now();
    const move = this.ai.computeBestMove(
      this.board,
      AI_PLAYER,
      this.lastMove
    );
    const elapsed = Date.now() - start;

    if (!move) {
      this.setData({
        statusMessage: 'AI 暂无可用落点，判为和棋',
        isHumanTurn: false,
        gameOver: true
      });
      this.aiThinking = false;
      return;
    }

    this._placeStone(move.row, move.col, AI_PLAYER);
    const victory = this._checkVictory(move.row, move.col, AI_PLAYER);
    const moveCount = this.data.moveCount + 1;
    this.setData({
      moveCount
    });

    if (victory) {
      this.setData({
        statusMessage: 'AI 完成连五胜利',
        gameOver: true,
        isHumanTurn: false
      });
    } else if (moveCount >= BOARD_SIZE * BOARD_SIZE) {
      this.setData({
        statusMessage: '棋盘落满，双方和棋',
        isHumanTurn: false,
        gameOver: true
      });
    } else {
      this.setData({
        isHumanTurn: true,
        statusMessage: `轮到玩家落子（AI 用时 ${elapsed}ms）`
      });
    }
    this.aiThinking = false;
  },

  _placeStone(row, col, player) {
    this.board[row][col] = player;
    this.lastMove = { row, col, player };
    this._drawBoard();
  },

  _locateCell(x, y) {
    if (!this.canvasWidth) {
      return { row: -1, col: -1 };
    }
    const offsetX = x - this.gridPadding;
    const offsetY = y - this.gridPadding;
    const col = Math.round(offsetX / this.gridSize);
    const row = Math.round(offsetY / this.gridSize);

    if (
      col < 0 ||
      col >= BOARD_SIZE ||
      row < 0 ||
      row >= BOARD_SIZE
    ) {
      return { row: -1, col: -1 };
    }
    const centerX = this.gridPadding + col * this.gridSize;
    const centerY = this.gridPadding + row * this.gridSize;
    const distance = Math.hypot(centerX - x, centerY - y);
    if (distance > this.gridSize * 0.45) {
      return { row: -1, col: -1 };
    }
    return { row, col };
  },

  _drawBoard() {
    if (!this.ctx) {
      return;
    }
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    this._drawBackground(ctx);
    this._drawGrid(ctx);
    this._drawStarPoints(ctx);
    this._drawPieces(ctx);
  },

  _drawBackground(ctx) {
    const gradient = ctx.createLinearGradient(
      0,
      0,
      this.canvasWidth,
      this.canvasHeight
    );
    gradient.addColorStop(0, '#e1c27a');
    gradient.addColorStop(1, '#c5994a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  },

  _drawGrid(ctx) {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const pos = this.gridPadding + i * this.gridSize;
      ctx.beginPath();
      ctx.moveTo(this.gridPadding, pos);
      ctx.lineTo(
        this.canvasWidth - this.gridPadding,
        pos
      );
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos, this.gridPadding);
      ctx.lineTo(
        pos,
        this.canvasHeight - this.gridPadding
      );
      ctx.stroke();
    }
  },

  _drawStarPoints(ctx) {
    const stars = [3, 7, 11];
    const radius = this.gridSize * 0.12;
    ctx.fillStyle = '#333';
    stars.forEach(i => {
      stars.forEach(j => {
        const x = this.gridPadding + i * this.gridSize;
        const y = this.gridPadding + j * this.gridSize;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  },

  _drawPieces(ctx) {
    const stoneRadius = this.gridSize * 0.38;
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        const value = this.board[row][col];
        if (!value) continue;
        const x = this.gridPadding + col * this.gridSize;
        const y = this.gridPadding + row * this.gridSize;
        ctx.beginPath();
        ctx.arc(x, y, stoneRadius, 0, Math.PI * 2);
        if (value === HUMAN_PLAYER) {
          const gradient = ctx.createRadialGradient(
            x - stoneRadius * 0.4,
            y - stoneRadius * 0.4,
            stoneRadius * 0.1,
            x,
            y,
            stoneRadius
          );
          gradient.addColorStop(0, '#f0f0f0');
          gradient.addColorStop(1, '#1a1a1a');
          ctx.fillStyle = gradient;
        } else {
          const gradient = ctx.createRadialGradient(
            x - stoneRadius * 0.4,
            y - stoneRadius * 0.4,
            stoneRadius * 0.1,
            x,
            y,
            stoneRadius
          );
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(1, '#bbbbbb');
          ctx.fillStyle = gradient;
        }
        ctx.fill();
      }
    }

    if (this.lastMove) {
      const { row, col } = this.lastMove;
      const x = this.gridPadding + col * this.gridSize;
      const y = this.gridPadding + row * this.gridSize;
      ctx.beginPath();
      ctx.strokeStyle = '#ff4d4f';
      ctx.lineWidth = 2;
      const highlightRadius = stoneRadius * 0.55;
      ctx.arc(x, y, highlightRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  _checkVictory(row, col, player) {
    const directions = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1]
    ];
    for (const [dx, dy] of directions) {
      let count = 1;
      count += this._countStones(row, col, dx, dy, player);
      count += this._countStones(row, col, -dx, -dy, player);
      if (count >= 5) {
        return true;
      }
    }
    return false;
  },

  _countStones(row, col, dx, dy, player) {
    let count = 0;
    let r = row + dx;
    let c = col + dy;
    while (
      r >= 0 &&
      r < BOARD_SIZE &&
      c >= 0 &&
      c < BOARD_SIZE &&
      this.board[r][c] === player
    ) {
      count += 1;
      r += dx;
      c += dy;
    }
    return count;
  },

  onShareAppMessage() {
    return {
      title: '豆芽五子棋：和 AI 大战一场！',
      path: '/pages/index/index'
    };
  }
});
