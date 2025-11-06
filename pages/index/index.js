const GomokuAI = require('../../utils/gomokuAI');

Page({
  data: {
    boardSize: 15,
    canvasSize: 0,
    cellSize: 0,
    isGameOver: false,
    currentPlayer: 1,
    message: '轮到你执黑落子'
  },

  onLoad() {
    this.humanStone = 1; // 黑棋
    this.aiStone = -1; // 白棋
    this.padding = 0;
    this.board = [];
    this.lastMove = null;
    this.canvasRect = null;
    this.ctx = null;
    this.aiEngine = new GomokuAI(this.data.boardSize, this.humanStone, this.aiStone, 3);
  },

  onReady() {
    this.ctx = wx.createCanvasContext('boardCanvas');
    this._initBoard();
    this._measureCanvas(() => {
      this._render();
    });
  },

  _measureCanvas(callback) {
    wx.createSelectorQuery()
      .in(this)
      .select('.board-canvas')
      .boundingClientRect(rect => {
        const size = rect && rect.width ? rect.width : 650;
        this.canvasRect = rect || { left: 0, top: 0, width: size, height: size };
        this.padding = size * 0.05;
        const cellSize = (size - this.padding * 2) / (this.data.boardSize - 1);
        this.setData({ canvasSize: size, cellSize }, () => {
          if (typeof callback === 'function') {
            callback();
          }
        });
      })
      .exec();
  },

  _initBoard() {
    const size = this.data.boardSize;
    this.board = new Array(size).fill(0).map(() => new Array(size).fill(0));
    this.lastMove = null;
    this.aiEngine.boardSize = size;
  },

  _render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const size = this.data.canvasSize;

    ctx.clearRect(0, 0, size, size);
    this._drawGrid(ctx);
    this._drawPieces(ctx);
    ctx.draw();
  },

  _drawGrid(ctx) {
    const { boardSize, cellSize } = this.data;
    const padding = this.padding;
    const size = this.data.canvasSize;

    ctx.save();
    ctx.setFillStyle('#f2c97d');
    ctx.fillRect(0, 0, size, size);

    ctx.setStrokeStyle('#9c6b30');
    ctx.setLineWidth(1);

    for (let i = 0; i < boardSize; i++) {
      const pos = padding + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(size - padding, pos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, size - padding);
      ctx.stroke();
    }

    const starIndices = [3, 7, 11];
    const starRadius = cellSize * 0.12;
    ctx.setFillStyle('#684b1e');
    starIndices.forEach(r => {
      starIndices.forEach(c => {
        const x = padding + c * cellSize;
        const y = padding + r * cellSize;
        ctx.beginPath();
        ctx.arc(x, y, starRadius, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    ctx.restore();
  },

  _drawPieces(ctx) {
    const { boardSize, cellSize } = this.data;
    const padding = this.padding;
    const radius = cellSize * 0.4;

    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const value = this.board[row][col];
        if (value === 0) continue;

        const x = padding + col * cellSize;
        const y = padding + row * cellSize;

        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        if (value === this.humanStone) {
          ctx.setFillStyle('#2f2f2f');
        } else {
          const gradient = ctx.createCircularGradient(x, y, radius);
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(1, '#d9d9d9');
          ctx.setFillStyle(gradient);
        }
        ctx.fill();

        if (this.lastMove && this.lastMove.row === row && this.lastMove.col === col) {
          ctx.setStrokeStyle('#ff5722');
          ctx.setLineWidth(2);
          ctx.beginPath();
          ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  },

  handleTap(e) {
    if (this.data.isGameOver || this.data.currentPlayer !== this.humanStone) return;
    if (!this.canvasRect) return;

    const { cellSize } = this.data;
    const padding = this.padding;
    const x = e.detail.x - this.canvasRect.left - padding;
    const y = e.detail.y - this.canvasRect.top - padding;

    const col = Math.round(x / cellSize);
    const row = Math.round(y / cellSize);

    if (!this._isWithinBoard(row, col)) return;

    const centerX = col * cellSize;
    const centerY = row * cellSize;
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    if (distance > cellSize * 0.6) return;

    if (this.board[row][col] !== 0) return;

    this._placeStone(row, col, this.humanStone);
    this.lastMove = { row, col, player: this.humanStone };
    this._render();

    if (this._checkWinner(row, col, this.humanStone)) {
      this._endGame('你赢了！恭喜！');
      return;
    }

    if (this._isBoardFull()) {
      this._endGame('棋盘已满，平局！');
      return;
    }

    this.setData({ currentPlayer: this.aiStone, message: 'AI思考中...' });

    setTimeout(() => {
      this._aiMove();
    }, 60);
  },

  _aiMove() {
    if (this.data.isGameOver) return;

    const move = this.aiEngine.searchBestMove(this.board);

    if (!move) {
      this._endGame('棋盘已满，平局！');
      return;
    }

    this._placeStone(move.row, move.col, this.aiStone);
    this.lastMove = { row: move.row, col: move.col, player: this.aiStone };
    this._render();

    if (this._checkWinner(move.row, move.col, this.aiStone)) {
      this._endGame('AI获胜，下次再接再厉！');
      return;
    }

    if (this._isBoardFull()) {
      this._endGame('棋盘已满，平局！');
      return;
    }

    this.setData({
      currentPlayer: this.humanStone,
      message: '轮到你执黑落子'
    });
  },

  _placeStone(row, col, player) {
    this.board[row][col] = player;
  },

  _checkWinner(row, col, player) {
    const directions = [
      { dr: 1, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 }
    ];

    for (const { dr, dc } of directions) {
      let count = 1;
      count += this._countDirection(row, col, dr, dc, player);
      count += this._countDirection(row, col, -dr, -dc, player);
      if (count >= 5) {
        return true;
      }
    }

    return false;
  },

  _countDirection(row, col, dr, dc, player) {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    const size = this.data.boardSize;

    while (r >= 0 && c >= 0 && r < size && c < size && this.board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }

    return count;
  },

  _isBoardFull() {
    const size = this.data.boardSize;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (this.board[row][col] === 0) return false;
      }
    }
    return true;
  },

  _isWithinBoard(row, col) {
    const size = this.data.boardSize;
    return row >= 0 && col >= 0 && row < size && col < size;
  },

  resetGame() {
    this._initBoard();
    this.setData({
      isGameOver: false,
      currentPlayer: this.humanStone,
      message: '轮到你执黑落子'
    }, () => {
      this._render();
    });
  },

  _endGame(message) {
    this.setData({
      isGameOver: true,
      message
    });
  }
});
