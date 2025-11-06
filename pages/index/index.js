import GomokuAI from '../../utils/gomokuAi';
import OnlineMatch from '../../utils/onlineMatch';

const HUMAN = 1;
const AI = -1;
const MODE = {
  HUMAN_VS_AI: 'HUMAN_VS_AI',
  HUMAN_VS_HUMAN: 'HUMAN_VS_HUMAN',
  ONLINE: 'ONLINE'
};

Page({
  data: {
    boardSize: 15,
    cellSize: 40,
    padding: 20,
    canvasSize: 0,
    message: '',
    humanFirst: true,
    gameOver: false,
    modeOptions: [
      { label: '人机对弈', value: MODE.HUMAN_VS_AI },
      { label: '双人同屏', value: MODE.HUMAN_VS_HUMAN },
      { label: '联网对战', value: MODE.ONLINE }
    ],
    modeIndex: 0,
    mode: MODE.HUMAN_VS_AI,
    difficultyOptions: [
      { label: '快速（深度 2）', value: 'quick', strategy: 'negamax', maxDepth: 2, maxCandidates: 16 },
      { label: '标准（深度 3）', value: 'standard', strategy: 'negamax', maxDepth: 3, maxCandidates: 14 },
      { label: '蒙特卡洛（每手 48 次模拟）', value: 'mcts', strategy: 'mcts', simulations: 48, maxCandidates: 12, playoutDepth: 36 }
    ],
    difficultyIndex: 1,
    historyVisible: false,
    historyList: [],
    onlineStatus: 'disconnected',
    onlineStatusText: '未连接，请先加入房间',
    onlineRoomId: '',
    replaying: false
  },

  onLoad() {
    const { boardSize, cellSize, padding } = this.data;
    const canvasSize = padding * 2 + cellSize * (boardSize - 1);
    this.setData({ canvasSize });

    this.ctx = wx.createCanvasContext('board', this);
    this.initAi();
    this.resetGame();
  },

  onUnload() {
    this.teardownOnlineMatch();
  },

  initAi() {
    const { boardSize, difficultyOptions, difficultyIndex } = this.data;
    const option = difficultyOptions[difficultyIndex];
    this.ai = new GomokuAI({
      boardSize,
      maxDepth: option.maxDepth,
      maxCandidates: option.maxCandidates,
      strategy: option.strategy,
      simulations: option.simulations,
      playoutDepth: option.playoutDepth
    });
  },

  resetGame() {
    const { boardSize, humanFirst, mode } = this.data;
    if (mode !== MODE.ONLINE) {
      this.onlineFirstStone = HUMAN;
      this.myStone = HUMAN;
    }
    const preservedOnlineTurn = mode === MODE.ONLINE ? this.isMyTurn : false;
    this.board = this.createEmptyBoard(boardSize);
    this.boardSnapshots = [this.cloneBoard(this.board)];
    this.history = [];
    this.redoStack = [];
    this.lastMove = null;
    this.savedState = null;
    this.replayIndex = null;
    this.isMyTurn = preservedOnlineTurn;

    let message = '';
    if (mode === MODE.HUMAN_VS_AI) {
      message = humanFirst ? '轮到你落子' : '等待电脑先手';
    } else if (mode === MODE.HUMAN_VS_HUMAN) {
      message = '黑棋先手，轮到黑棋落子';
    } else {
      if (this.data.onlineStatus === 'connected') {
        message = this.isMyTurn ? '请先落子' : '等待对局开始';
      } else {
        message = '请先加入房间';
      }
    }

    this.setData({
      message,
      gameOver: false,
      historyVisible: false,
      historyList: []
    });

    this.render();
    this.autoMoveIfNeeded();
  },

  restartGame() {
    if (this.data.mode === MODE.ONLINE && this.data.onlineStatus === 'connected') {
      wx.showToast({ title: '联网模式由房间双方协商重开', icon: 'none' });
      return;
    }
    this.resetGame();
  },

  toggleFirst() {
    if (this.data.mode !== MODE.HUMAN_VS_AI) return;
    this.setData({ humanFirst: !this.data.humanFirst }, () => {
      this.resetGame();
    });
  },

  handleModeChange(event) {
    const modeIndex = Number(event.detail.value);
    const { value } = this.data.modeOptions[modeIndex];
    if (value === this.data.mode) return;

    if (value !== MODE.ONLINE) {
      this.teardownOnlineMatch();
      this.setData({
        onlineStatus: 'disconnected',
        onlineStatusText: '未连接，请先加入房间'
      });
    }

    this.setData({ modeIndex, mode: value }, () => {
      if (value === MODE.HUMAN_VS_AI) {
        this.initAi();
      }
      if (value === MODE.ONLINE) {
        this.myStone = null;
        this.onlineFirstStone = HUMAN;
        this.setupOnlineMatch();
      }
      this.resetGame();
    });
  },

  handleDifficultyChange(event) {
    const difficultyIndex = Number(event.detail.value);
    this.setData({ difficultyIndex }, () => {
      this.initAi();
      this.resetGame();
    });
  },

  handleRoomInput(event) {
    this.setData({ onlineRoomId: event.detail.value.trim() });
  },

  setupOnlineMatch() {
    if (this.onlineMatch) {
      return;
    }

    this.onlineMatch = new OnlineMatch({
      serverUrl: 'wss://example.com/gomoku',
      onOpen: () => {
        this.setOnlineStatus('connected', '已连接，等待匹配对手');
      },
      onClose: () => {
        this.setOnlineStatus('disconnected', '连接已断开，可重新加入房间');
        this.isMyTurn = false;
      },
      onError: err => {
        this.setOnlineStatus('error', err?.message || '连接异常');
        this.isMyTurn = false;
      },
      onMessage: payload => {
        this.handleOnlineMessage(payload);
      }
    });
  },

  teardownOnlineMatch() {
    if (this.onlineMatch) {
      this.onlineMatch.close();
      this.onlineMatch = null;
    }
    this.myStone = null;
    this.onlineFirstStone = HUMAN;
    this.isMyTurn = false;
  },

  connectOnline() {
    if (this.data.mode !== MODE.ONLINE) return;
    const roomId = this.data.onlineRoomId;
    if (!roomId) {
      wx.showToast({ title: '请先输入房间号', icon: 'none' });
      return;
    }

    this.setupOnlineMatch();
    this.setOnlineStatus('connecting', '连接中...');
    this.onlineMatch
      .connect(roomId)
      .catch(error => {
        this.setOnlineStatus('error', error?.message || '无法连接服务器');
      });
  },

  leaveOnlineRoom() {
    if (this.onlineMatch) {
      this.onlineMatch.leave();
    }
    this.teardownOnlineMatch();
    this.setOnlineStatus('disconnected', '已离开房间');
    this.resetGame();
  },

  setOnlineStatus(status, text) {
    this.setData({ onlineStatus: status, onlineStatusText: text || '' });
  },

  handleOnlineMessage(message) {
    switch (message?.type) {
      case 'joined': {
        const { roomId, stone, first } = message.payload || {};
        this.myStone = stone === AI ? AI : HUMAN;
        this.onlineFirstStone = first === AI ? AI : HUMAN;
        this.isMyTurn = this.myStone === this.onlineFirstStone;
        this.setOnlineStatus('connected', `房间 ${roomId} 已加入，${this.isMyTurn ? '请先落子' : '等待对手落子'}`);
        this.resetGame();
        break;
      }
      case 'start': {
        this.isMyTurn = message.payload?.turn === 'self';
        this.onlineFirstStone = this.isMyTurn ? this.myStone : -this.myStone;
        this.setData({ message: this.isMyTurn ? '对局开始，轮到你落子' : '对局开始，等待对手落子' });
        break;
      }
      case 'move': {
        const { x, y, player } = message.payload || {};
        if (typeof x === 'number' && typeof y === 'number') {
          this.processMove(x, y, player || -this.myStone, { source: 'online' });
          this.isMyTurn = true;
          if (!this.data.gameOver) {
            this.setData({ message: '轮到你落子' });
          }
        }
        break;
      }
      case 'opponentLeft': {
        this.setOnlineStatus('connected', '对手已离开，请等待重新加入');
        this.isMyTurn = false;
        break;
      }
      case 'error': {
        this.setOnlineStatus('error', message.payload?.message || '服务器错误');
        break;
      }
      default:
        break;
    }
  },

  handleTouch(event) {
    if (this.data.gameOver || this.data.historyVisible || this.data.replaying) return;

    const touch = event.changedTouches?.[0];
    if (!touch) return;

    const { padding, cellSize, boardSize } = this.data;
    const { x, y } = touch;

    const gridX = Math.round((x - padding) / cellSize);
    const gridY = Math.round((y - padding) / cellSize);

    if (gridX < 0 || gridX >= boardSize || gridY < 0 || gridY >= boardSize) {
      return;
    }

    const targetX = padding + gridX * cellSize;
    const targetY = padding + gridY * cellSize;
    const distance = Math.sqrt((x - targetX) ** 2 + (y - targetY) ** 2);
    if (distance > cellSize * 0.45) {
      return;
    }

    if (this.board[gridY][gridX] !== 0) {
      return;
    }

    const mode = this.data.mode;
    const nextPlayer = this.getNextPlayer();

    if (mode === MODE.HUMAN_VS_AI) {
      if (nextPlayer !== HUMAN) return;
      this.processMove(gridX, gridY, HUMAN, { source: 'human' });
      return;
    }

    if (mode === MODE.HUMAN_VS_HUMAN) {
      this.processMove(gridX, gridY, nextPlayer, { source: 'human' });
      return;
    }

    if (mode === MODE.ONLINE) {
      if (!this.myStone) {
        wx.showToast({ title: '尚未分配阵营', icon: 'none' });
        return;
      }
      if (!this.isMyTurn) {
        wx.showToast({ title: '暂未轮到你', icon: 'none' });
        return;
      }
      if (nextPlayer !== this.myStone) {
        wx.showToast({ title: '等待服务器同步', icon: 'none' });
        return;
      }
      this.processMove(gridX, gridY, this.myStone, { source: 'online-self' });
    }
  },

  processMove(x, y, player, options = {}) {
    const ended = this.makeMove(x, y, player);

    if (ended) {
      if (this.data.mode === MODE.ONLINE && options.source === 'online-self' && this.onlineMatch) {
        this.onlineMatch.sendMove({ x, y, player });
        this.isMyTurn = false;
      } else if (this.data.mode === MODE.ONLINE && options.source === 'online') {
        this.isMyTurn = true;
      }
      return;
    }

    const mode = this.data.mode;

    if (mode === MODE.HUMAN_VS_AI) {
      if (player === HUMAN) {
        this.setData({ message: '电脑思考中...' });
        this.autoMoveIfNeeded();
      } else {
        this.setData({ message: '轮到你落子' });
      }
    } else if (mode === MODE.HUMAN_VS_HUMAN) {
      const nextPlayer = this.getNextPlayer();
      this.setData({ message: nextPlayer === HUMAN ? '轮到黑棋落子' : '轮到白棋落子' });
    } else if (mode === MODE.ONLINE) {
      if (options.source === 'online-self') {
        this.onlineMatch?.sendMove({ x, y, player });
        this.isMyTurn = false;
        this.setData({ message: '已落子，等待对手应手' });
      } else if (options.source === 'online') {
        this.isMyTurn = true;
        this.setData({ message: '轮到你落子' });
      }
    }
  },

  makeMove(x, y, player) {
    this.board[y][x] = player;
    this.lastMove = { x, y, player };
    this.recordMove(x, y, player);
    this.render();

    if (this.checkWin(x, y, player)) {
      const winnerText = player === HUMAN ? '黑棋获胜！' : '白棋获胜！';
      let message = winnerText;
      if (this.data.mode === MODE.HUMAN_VS_AI) {
        message = player === HUMAN ? '恭喜，你赢了！' : '电脑获胜，再接再厉！';
      }
      this.setData({
        message,
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

  recordMove(x, y, player) {
    const moveNumber = this.history.length + 1;
    const entry = {
      moveNumber,
      player,
      position: { x, y },
      label: `${moveNumber}. ${player === HUMAN ? '黑棋' : '白棋'} (${x + 1}, ${y + 1})`,
      detail: `坐标：${x + 1}, ${y + 1}`
    };

    this.history.push(entry);
    this.boardSnapshots.push(this.cloneBoard(this.board));
    this.redoStack = [];
    this.setData({ historyList: this.history.map(item => ({
      moveNumber: item.moveNumber,
      label: item.label,
      detail: item.detail
    })) });
  },

  openHistoryPanel() {
    if (!this.history.length) {
      wx.showToast({ title: '暂无历史记录', icon: 'none' });
      return;
    }
    this.savedState = {
      board: this.cloneBoard(this.board),
      lastMove: this.lastMove ? { ...this.lastMove } : null,
      message: this.data.message,
      gameOver: this.data.gameOver,
      redoStack: [...this.redoStack],
      historyLength: this.history.length,
      boardSnapshotsLength: this.boardSnapshots.length
    };
    this.replayIndex = this.history.length - 1;
    this.setData({ historyVisible: true });
  },

  closeHistoryPanel() {
    this.replayIndex = null;
    if (this.savedState) {
      this.applySnapshot(this.savedState.board);
      this.lastMove = this.savedState.lastMove;
      this.redoStack = this.savedState.redoStack || [];
      this.setData({
        message: this.savedState.message,
        gameOver: this.savedState.gameOver,
        historyVisible: false
      });
      this.render();
      this.savedState = null;
    } else {
      this.setData({ historyVisible: false });
    }
  },

  previewHistory(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    const snapshot = this.boardSnapshots[index + 1];
    if (!snapshot) return;
    this.replayIndex = index;
    this.applySnapshot(snapshot);
    this.lastMove = this.history[index] ? { ...this.history[index].position, player: this.history[index].player } : null;
    this.setData({
      message: `复盘至第 ${index + 1} 手`,
      gameOver: true
    });
    this.render();
  },

  applyHistory(event) {
    if (this.data.mode === MODE.ONLINE) {
      wx.showToast({ title: '联网模式不支持回到历史步骤', icon: 'none' });
      return;
    }
    const index = Number(event.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    const snapshot = this.boardSnapshots[index + 1];
    if (!snapshot) return;

    this.history = this.history.slice(0, index + 1);
    this.boardSnapshots = this.boardSnapshots.slice(0, index + 2);
    this.redoStack = [];
    this.applySnapshot(snapshot);
    this.lastMove = this.history[index]
      ? { ...this.history[index].position, player: this.history[index].player }
      : null;
    this.setData({
      historyList: this.history.map(item => ({ moveNumber: item.moveNumber, label: item.label, detail: item.detail })),
      historyVisible: false,
      gameOver: false,
      message: '已回到所选步骤，可继续对局'
    });
    this.render();
    this.savedState = null;
    this.replayIndex = null;
    this.autoMoveIfNeeded();
  },

  resumeCurrentGame() {
    this.closeHistoryPanel();
  },

  undoMove() {
    if (!this.history.length) {
      wx.showToast({ title: '无法悔棋', icon: 'none' });
      return;
    }
    if (this.data.mode === MODE.ONLINE) {
      wx.showToast({ title: '联网模式不可悔棋', icon: 'none' });
      return;
    }

    const targetPlayer = HUMAN;
    do {
      const entry = this.history.pop();
      const snapshot = this.boardSnapshots.pop();
      this.redoStack.push({ entry, snapshot });
    } while (
      this.data.mode === MODE.HUMAN_VS_AI &&
      this.history.length > 0 &&
      this.getNextPlayer() !== targetPlayer
    );

    const latestSnapshot = this.boardSnapshots[this.boardSnapshots.length - 1];
    this.applySnapshot(latestSnapshot);
    this.lastMove = this.history.length
      ? { ...this.history[this.history.length - 1].position, player: this.history[this.history.length - 1].player }
      : null;
    this.setData({
      historyList: this.history.map(item => ({ moveNumber: item.moveNumber, label: item.label, detail: item.detail })),
      message: '悔棋成功',
      gameOver: false
    });
    this.render();
    this.autoMoveIfNeeded();
  },

  redoMove() {
    if (!this.redoStack.length) {
      wx.showToast({ title: '没有可撤销的悔棋', icon: 'none' });
      return;
    }
    if (this.data.mode === MODE.ONLINE) {
      wx.showToast({ title: '联网模式不可操作', icon: 'none' });
      return;
    }

    const targetPlayer = HUMAN;
    do {
      if (!this.redoStack.length) break;
      const record = this.redoStack.pop();
      this.history.push(record.entry);
      this.boardSnapshots.push(record.snapshot);
    } while (
      this.data.mode === MODE.HUMAN_VS_AI &&
      this.redoStack.length &&
      this.getNextPlayer() !== targetPlayer
    );

    const latestSnapshot = this.boardSnapshots[this.boardSnapshots.length - 1];
    this.applySnapshot(latestSnapshot);
    this.lastMove = this.history.length
      ? { ...this.history[this.history.length - 1].position, player: this.history[this.history.length - 1].player }
      : null;
    this.setData({
      historyList: this.history.map(item => ({ moveNumber: item.moveNumber, label: item.label, detail: item.detail })),
      message: '已恢复棋步',
      gameOver: false
    });
    this.render();
    this.autoMoveIfNeeded();
  },

  autoMoveIfNeeded() {
    if (this.data.mode !== MODE.HUMAN_VS_AI) return;
    if (this.data.gameOver) return;
    if (this.getNextPlayer() !== AI) return;

    this.setData({ message: '电脑思考中...' });
    this.thinkForAi();
  },

  thinkForAi() {
    if (this.data.gameOver || this.data.mode !== MODE.HUMAN_VS_AI) return;

    setTimeout(() => {
      const move = this.ai.bestMove(this.board, AI);
      if (!move) {
        this.declareDraw();
        return;
      }
      const ended = this.makeMove(move.x, move.y, AI);
      if (!ended) {
        this.setData({ message: '轮到你落子' });
      }
    }, 60);
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

  createEmptyBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(0));
  },

  cloneBoard(board) {
    return board.map(row => row.slice());
  },

  applySnapshot(snapshot) {
    this.board = this.cloneBoard(snapshot);
  },

  getNextPlayer() {
    const moves = this.history.length;
    const mode = this.data.mode;
    if (mode === MODE.HUMAN_VS_AI) {
      if (this.data.humanFirst) {
        return moves % 2 === 0 ? HUMAN : AI;
      }
      return moves % 2 === 0 ? AI : HUMAN;
    }
    if (mode === MODE.HUMAN_VS_HUMAN) {
      return moves % 2 === 0 ? HUMAN : AI;
    }
    if (mode === MODE.ONLINE) {
      const first = this.onlineFirstStone || HUMAN;
      return moves % 2 === 0 ? first : -first;
    }
    return HUMAN;
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
