const GomokuAI = require('../../utils/gomokuAI');

Page({
  data: {
    boardSize: 15,
    canvasSize: 0,
    cellSize: 0,
    isGameOver: false,
    currentPlayer: 1,
    message: '轮到你执黑落子',
    difficultyLevels: [
      { label: '入门', desc: '浅层搜索（深度 1），快速响应', maxDepth: 1, maxCandidates: 6, useIterativeDeepening: false, timeLimit: 0 },
      { label: '标准', desc: '中等搜索（深度 3），攻守均衡', maxDepth: 3, maxCandidates: 10, useIterativeDeepening: false, timeLimit: 0 },
      { label: '高手', desc: '深层搜索（深度 4）+ 迭代加深', maxDepth: 4, maxCandidates: 16, useIterativeDeepening: true, timeLimit: 900 }
    ],
    difficultyIndex: 1,
    moveList: [],
    historyRecords: [],
    useIterativeDeepening: false
  },

  onLoad() {
    this.humanStone = 1; // 黑棋
    this.aiStone = -1; // 白棋
    this.padding = 0;
    this.board = [];
    this.lastMove = null;
    this.canvasRect = null;
    this.ctx = null;
    this.currentMoves = [];
    this.aiEngine = new GomokuAI(this.data.boardSize, this.humanStone, this.aiStone, 3);
    this._applyDifficulty(this.data.difficultyIndex);
    this._loadHistoryRecords();
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
    this.currentMoves = [];
    this.aiEngine.boardSize = size;
    if (this.aiEngine && typeof this.aiEngine.ensureZobrist === 'function') {
      this.aiEngine.ensureZobrist(size);
    }
    if (this.aiEngine && typeof this.aiEngine.resetCache === 'function') {
      this.aiEngine.resetCache();
    }
    this.setData({ moveList: [] });
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
      this._endGame('你赢了！恭喜！', 'human');
      return;
    }

    if (this._isBoardFull()) {
      this._endGame('棋盘已满，平局！', 'draw');
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
      this._endGame('棋盘已满，平局！', 'draw');
      return;
    }

    this._placeStone(move.row, move.col, this.aiStone);
    this.lastMove = { row: move.row, col: move.col, player: this.aiStone };
    this._render();

    if (this._checkWinner(move.row, move.col, this.aiStone)) {
      this._endGame('AI获胜，下次再接再厉！', 'ai');
      return;
    }

    if (this._isBoardFull()) {
      this._endGame('棋盘已满，平局！', 'draw');
      return;
    }

    this.setData({
      currentPlayer: this.humanStone,
      message: '轮到你执黑落子'
    });
  },

  _placeStone(row, col, player, options = {}) {
    this.board[row][col] = player;
    if (options.record !== false) {
      this._recordMove(row, col, player);
    }
  },

  _recordMove(row, col, player) {
    if (!this.currentMoves) {
      this.currentMoves = [];
    }

    const move = this._formatMove(row, col, player);
    this.currentMoves.push(move);
    this.setData({ moveList: this.currentMoves.slice(0) });
  },

  _formatMove(row, col, player) {
    const playerLabel = player === this.humanStone ? '黑' : '白';
    const coord = `${this._columnLabel(col)}${row + 1}`;
    return {
      row,
      col,
      player,
      playerLabel,
      coord
    };
  },

  _columnLabel(col) {
    const startCharCode = 'A'.charCodeAt(0);
    if (col < 26) {
      return String.fromCharCode(startCharCode + col);
    }
    const first = Math.floor(col / 26) - 1;
    const second = col % 26;
    return `${String.fromCharCode(startCharCode + first)}${String.fromCharCode(startCharCode + second)}`;
  },

  _applyDifficulty(index) {
    const presets = this.data.difficultyLevels || [];
    const preset = presets[index] || presets[0];
    if (!preset || !this.aiEngine) return;

    if (typeof this.aiEngine.configure === 'function') {
      this.aiEngine.configure({
        maxDepth: preset.maxDepth,
        maxCandidates: preset.maxCandidates,
        useIterativeDeepening: preset.useIterativeDeepening,
        timeLimit: preset.timeLimit
      });
    } else {
      this.aiEngine.maxDepth = preset.maxDepth;
      this.aiEngine.maxCandidates = preset.maxCandidates;
      this.aiEngine.useIterativeDeepening = preset.useIterativeDeepening;
      this.aiEngine.timeLimit = preset.timeLimit;
    }

    this.setData({
      difficultyIndex: index,
      useIterativeDeepening: !!preset.useIterativeDeepening
    });
  },

  onDifficultyChange(e) {
    const index = Number(e.detail.value);
    if (Number.isNaN(index)) return;
    this._applyDifficulty(index);
    if (this.data.isGameOver) return;
    const preset = this.data.difficultyLevels[index] || this.data.difficultyLevels[0];
    const turnMessage = this.data.currentPlayer === this.humanStone ? '轮到你执黑落子' : 'AI思考中...';
    this.setData({
      message: `已切换至${preset.label}难度，${turnMessage}`
    });
  },

  _loadHistoryRecords() {
    try {
      const history = wx.getStorageSync('gomoku_history') || [];
      const normalized = history.map(item => {
        const steps = item.steps || (item.moves ? item.moves.length : 0);
        return {
          ...item,
          steps,
          title: item.title || this._formatResultTitle(item.result, steps),
          createdAtText: item.createdAtText || this._formatTimestamp(item.createdAt || Date.now())
        };
      });
      this.setData({ historyRecords: normalized });
    } catch (err) {
      console.warn('加载历史棋谱失败', err);
      this.setData({ historyRecords: [] });
    }
  },

  _saveHistoryRecord(result, message) {
    if (!this.currentMoves || this.currentMoves.length === 0) return;
    let history = [];
    try {
      history = wx.getStorageSync('gomoku_history') || [];
    } catch (err) {
      console.warn('读取历史棋谱失败', err);
    }

    const timestamp = Date.now();
    const record = {
      id: timestamp,
      result,
      message,
      moves: this.currentMoves.slice(0),
      steps: this.currentMoves.length,
      createdAt: timestamp,
      createdAtText: this._formatTimestamp(timestamp),
      title: this._formatResultTitle(result, this.currentMoves.length)
    };

    history.unshift(record);
    if (history.length > 12) {
      history = history.slice(0, 12);
    }

    try {
      wx.setStorageSync('gomoku_history', history);
    } catch (err) {
      console.warn('保存历史棋谱失败', err);
    }

    this.setData({ historyRecords: history });
  },

  _formatResultTitle(result, steps) {
    let label = '平局';
    if (result === 'human') {
      label = '玩家胜';
    } else if (result === 'ai') {
      label = 'AI胜';
    }
    return `${label} · ${steps}手`;
  },

  _formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const pad = value => value.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  clearHistory() {
    wx.removeStorageSync('gomoku_history');
    this.setData({ historyRecords: [] });
    wx.showToast({ title: '历史已清空', icon: 'none' });
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

  _endGame(message, result = 'draw') {
    this.setData({
      isGameOver: true,
      message
    });
    this._saveHistoryRecord(result, message);
  }
});
