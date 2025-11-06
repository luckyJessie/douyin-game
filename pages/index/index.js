import GomokuAI from '../../utils/gomokuAi';

const HUMAN = 1;
const AI = -1;

Page({
  data: {
    boardSize: 15,
    cellSize: 40,
    padding: 20,
    canvasSize: 0,
    message: '',
    humanFirst: true,
    gameOver: false
  },

  onLoad() {
    const { boardSize, cellSize, padding } = this.data;
    const canvasSize = padding * 2 + cellSize * (boardSize - 1);
    this.setData({ canvasSize });

    this.ctx = wx.createCanvasContext('board', this);
    this.ai = new GomokuAI({
      boardSize,
      maxDepth: 2,
      maxCandidates: 16
    });

    this.resetGame();
  },

  resetGame() {
    const { boardSize, humanFirst } = this.data;
    this.board = Array.from({ length: boardSize }, () => Array(boardSize).fill(0));
    this.lastMove = null;
    this.currentPlayer = humanFirst ? HUMAN : AI;

    this.setData({
      message: humanFirst ? '轮到你落子' : '等待电脑落子',
      gameOver: false
    });

    this.render();

    if (!humanFirst) {
      this.thinkForAi();
    }
  },

  restartGame() {
    this.resetGame();
  },

  toggleFirst() {
    this.setData({ humanFirst: !this.data.humanFirst }, () => {
      this.resetGame();
    });
  },

  handleTouch(event) {
    if (this.data.gameOver) return;
    if (this.currentPlayer !== HUMAN) return;

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const { padding, cellSize, boardSize } = this.data;
    const x = touch.x;
    const y = touch.y;

    const gridX = Math.round((x - padding) / cellSize);
    const gridY = Math.round((y - padding) / cellSize);

    if (gridX < 0 || gridX >= boardSize || gridY < 0 || gridY >= boardSize) {
      return;
    }

    const targetX = padding + gridX * cellSize;
    const targetY = padding + gridY * cellSize;
    const distance = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);

    if (distance > cellSize * 0.45) {
      // 避免误触到临近交叉点
      return;
    }

    if (this.board[gridY][gridX] !== 0) {
      return;
    }

    this.handlePlayerMove(gridX, gridY);
  },

  handlePlayerMove(x, y) {
    const ended = this.makeMove(x, y, HUMAN);
    if (!ended) {
      this.currentPlayer = AI;
      this.setData({ message: '电脑思考中...' });
      this.thinkForAi();
    }
  },

  thinkForAi() {
    if (this.data.gameOver) return;

    setTimeout(() => {
      const move = this.ai.bestMove(this.board, AI);

      if (!move) {
        this.declareDraw();
        return;
      }

      const ended = this.makeMove(move.x, move.y, AI);
      if (!ended) {
        this.currentPlayer = HUMAN;
        this.setData({ message: '轮到你落子' });
      }
    }, 80);
  },

  makeMove(x, y, player) {
    this.board[y][x] = player;
    this.lastMove = { x, y, player };

    this.render();

    if (this.checkWin(x, y, player)) {
      this.setData({
        message: player === HUMAN ? '恭喜，你赢了！' : '电脑获胜，再接再厉！',
        gameOver: true
      });
      return true;
    }

    if (this.isBoardFull()) {
      this.declareDraw();
      return true;
    }

    return false;
  },

  declareDraw() {
    this.setData({
      message: '平局，势均力敌！',
      gameOver: true
    });
  },

  isBoardFull() {
    return this.board.every(row => row.every(cell => cell !== 0));
  },

  checkWin(x, y, player) {
    const directions = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1]
    ];

    for (const [dx, dy] of directions) {
      const count =
        1 +
        this.countDirection(x, y, dx, dy, player) +
        this.countDirection(x, y, -dx, -dy, player);
      if (count >= 5) {
        return true;
      }
    }

    return false;
  },

  countDirection(x, y, dx, dy, player) {
    let count = 0;
    let nx = x + dx;
    let ny = y + dy;
    const size = this.data.boardSize;

    while (nx >= 0 && nx < size && ny >= 0 && ny < size && this.board[ny][nx] === player) {
      count += 1;
      nx += dx;
      ny += dy;
    }

    return count;
  },

  render() {
    this.drawBoard();
    this.drawPieces();
    if (this.lastMove) {
      this.highlightLastMove();
    }
    this.ctx.draw();
  },

  drawBoard() {
    const ctx = this.ctx;
    const { boardSize, cellSize, padding, canvasSize } = this.data;
    const length = cellSize * (boardSize - 1);

    ctx.setFillStyle('#f5deb3');
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.setStrokeStyle('#8b4513');
    ctx.setLineWidth(1);

    for (let i = 0; i < boardSize; i += 1) {
      const pos = padding + i * cellSize;

      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + length, pos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + length);
      ctx.stroke();
    }

    const starPoints = this.getStarPoints();
    ctx.setFillStyle('#8b4513');
    starPoints.forEach(point => {
      const cx = padding + point.x * cellSize;
      const cy = padding + point.y * cellSize;

      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  },

  getStarPoints() {
    if (this.data.boardSize !== 15) {
      return [];
    }

    return [
      { x: 3, y: 3 },
      { x: 3, y: 11 },
      { x: 7, y: 7 },
      { x: 11, y: 3 },
      { x: 11, y: 11 }
    ];
  },

  drawPieces() {
    const { boardSize } = this.data;
    for (let y = 0; y < boardSize; y += 1) {
      for (let x = 0; x < boardSize; x += 1) {
        const player = this.board[y][x];
        if (player !== 0) {
          this.drawPiece(x, y, player);
        }
      }
    }
  },

  drawPiece(x, y, player) {
    const ctx = this.ctx;
    const { cellSize, padding } = this.data;

    const radius = cellSize * 0.36;
    const cx = padding + x * cellSize;
    const cy = padding + y * cellSize;

    const gradient = ctx.createCircularGradient(cx - radius / 3, cy - radius / 3, radius);

    if (player === HUMAN) {
      gradient.addColorStop(0, '#4f4f4f');
      gradient.addColorStop(1, '#0a0a0a');
    } else {
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(1, '#c7c7c7');
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.setFillStyle(gradient);
    ctx.fill();

    ctx.setLineWidth(1);
    ctx.setStrokeStyle(player === HUMAN ? '#1f1f1f' : '#8a8a8a');
    ctx.stroke();
  },

  highlightLastMove() {
    const ctx = this.ctx;
    const { cellSize, padding } = this.data;
    const { x, y } = this.lastMove;

    const cx = padding + x * cellSize;
    const cy = padding + y * cellSize;
    const offset = cellSize * 0.2;

    ctx.setStrokeStyle('#ff7043');
    ctx.setLineWidth(2);

    ctx.beginPath();
    ctx.rect(cx - offset, cy - offset, offset * 2, offset * 2);
    ctx.stroke();
  }
});
