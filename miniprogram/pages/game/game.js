const { DIFFICULTY_SETTINGS } = require('../../utils/settings');

const BOARD_SIZE = 15;
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;
const SEGMENT_SIZE = 64;
const BITBOARD_SEGMENTS = Math.ceil(CELL_COUNT / SEGMENT_SIZE);
const WIN_COUNT = 5;
const EMPTY = 0;
const AI_PLAYER = 1; // 默认白子
const HUMAN_PLAYER = 2; // 默认黑子
const WIN_SCORE = 1000000;
const MONTE_CARLO_PLAYOUT_DEPTH = 24;
const CLOUD_ENV_ID = '';

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

const PATTERN_SCORES = {
  openFour: 100000,
  closedFour: 12000,
  openThree: 6000,
  closedThree: 800,
  openTwo: 400,
  closedTwo: 80,
  single: 10
};

const STAR_POINTS = [
  { row: 3, col: 3 },
  { row: 3, col: BOARD_SIZE - 4 },
  { row: BOARD_SIZE - 4, col: 3 },
  { row: BOARD_SIZE - 4, col: BOARD_SIZE - 4 },
  { row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) }
];

const STAR_POINT_MAP = STAR_POINTS.reduce((acc, point) => {
  acc[`${point.row}-${point.col}`] = true;
  return acc;
}, {});

const LINE_POSITIONS = Array.from({ length: BOARD_SIZE }, (_, index) => ((index / (BOARD_SIZE - 1)) * 100).toFixed(4));

const LINES = computeLines();

Page({
  data: {
    board: createEmptyBoard(),
    boardSize: BOARD_SIZE,
    starPointsMap: STAR_POINT_MAP,
    linePositions: LINE_POSITIONS,
    isPlayerTurn: true,
    gameOver: false,
    message: '玩家先手，请落子',
    lastMove: null,
    playerFirst: true,
    hintMove: null,
    canUndo: false,
    difficultyIndex: 1,
    difficultyLabel: DIFFICULTY_SETTINGS[1].label,
    isOnlineMode: false,
    onlineRoomId: '',
    joinRoomCode: '',
    onlineLoading: false,
    onlineMessage: '模式已切换为本地对弈',
    onlineOpponentReady: false,
    onlineCanAct: false,
    AI_PLAYER,
    HUMAN_PLAYER
  },

  async onLoad(options) {
    this.bitboards = createEmptyBitboards();
    this.history = [];
    this.roomWatcher = null;
    this.onlineDocId = null;
    this.onlinePlayerRole = 'black';
    this.db = null;
    this.cloudInited = false;

    const mode = options && options.mode === 'online' ? 'online' : 'local';
    let difficultyIndex = Number(options && options.difficulty);
    if (!Number.isInteger(difficultyIndex) || difficultyIndex < 0 || difficultyIndex >= DIFFICULTY_SETTINGS.length) {
      difficultyIndex = 1;
    }
    const playerFirst = options && options.first === 'ai' ? false : true;

    this.data.isOnlineMode = mode === 'online';
    this.data.difficultyIndex = difficultyIndex;
    this.data.difficultyLabel = DIFFICULTY_SETTINGS[difficultyIndex].label;
    this.data.playerFirst = playerFirst;

    this.setData({
      isOnlineMode: this.data.isOnlineMode,
      difficultyIndex: this.data.difficultyIndex,
      difficultyLabel: this.data.difficultyLabel,
      playerFirst: this.data.playerFirst,
      isPlayerTurn: this.data.isOnlineMode ? false : this.data.playerFirst,
      hintMove: null,
      canUndo: false,
      onlineMessage: this.data.isOnlineMode ? '请选择「创建房间」或输入房间号加入' : '模式已切换为本地对弈',
      message: this.data.isOnlineMode ? '请创建或加入在线房间' : (this.data.playerFirst ? '玩家先手，请落子' : 'AI先手，AI 正在落子...')
    });

    await this.resetGame();
  },

  onUnload() {
    this.teardownWatcher();
  },

  async resetGame() {
    if (this.data.isOnlineMode) {
      this.history = [];
      this.bitboards = createEmptyBitboards();
      this.setData({
        board: createEmptyBoard(),
        isPlayerTurn: false,
        gameOver: false,
        lastMove: null,
        hintMove: null,
        canUndo: false,
        message: this.data.onlineRoomId ? '等待在线对手同步棋盘' : '请先创建或加入在线房间',
        onlineCanAct: false
      });
      return;
    }

    this.history = [];
    this.bitboards = createEmptyBitboards();
    const board = createEmptyBoard();
    const playerFirst = this.data.playerFirst;
    const message = playerFirst ? '玩家先手，请落子' : 'AI先手，AI 正在落子...';

    this.setData({
      board,
      isPlayerTurn: playerFirst,
      gameOver: false,
      message,
      lastMove: null,
      hintMove: null,
      canUndo: false
    });

    if (!playerFirst) {
      this.scheduleAIMove();
    }
  },

  toggleFirstMove() {
    if (this.data.isOnlineMode) {
      return;
    }
    const nextFirst = !this.data.playerFirst;
    this.setData({
      playerFirst: nextFirst
    }, () => {
      this.resetGame();
    });
  },

  handleCellTap(event) {
    const row = Number(event.currentTarget.dataset.row);
    const col = Number(event.currentTarget.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      return;
    }

    if (this.data.isOnlineMode) {
      this.handleOnlineCellTap(row, col);
      return;
    }

    if (!this.data.isPlayerTurn || this.data.gameOver) {
      return;
    }

    const board = cloneBoard(this.data.board);
    if (board[row][col] !== EMPTY) {
      return;
    }

    board[row][col] = HUMAN_PLAYER;
    setStone(this.bitboards, row, col, HUMAN_PLAYER);
    this.history.push({ row, col, player: HUMAN_PLAYER });

    if (checkWin(board, row, col, HUMAN_PLAYER)) {
      this.setData({
        board,
        gameOver: true,
        lastMove: { row, col },
        hintMove: null,
        canUndo: this.history.length >= 2,
        message: '恭喜，你赢了！'
      });
      return;
    }

    if (isBoardFull(board)) {
      this.setData({
        board,
        gameOver: true,
        lastMove: { row, col },
        hintMove: null,
        canUndo: this.history.length >= 2,
        message: '平局，双方旗鼓相当！'
      });
      return;
    }

    this.setData({
      board,
      isPlayerTurn: false,
      lastMove: { row, col },
      hintMove: null,
      canUndo: this.history.length >= 2,
      message: 'AI 思考中...'
    });

    this.scheduleAIMove();
  },

  scheduleAIMove() {
    clearTimeout(this.aiTimer);
    this.aiTimer = setTimeout(() => this.aiMove(), 120);
  },

  aiMove() {
    if (this.data.gameOver || this.data.isOnlineMode) {
      return;
    }

    const settings = getCurrentDifficulty(this.data.difficultyIndex);
    const board = cloneBoard(this.data.board);
    let move = null;

    if (settings.method === 'mcts') {
      move = mctsSearch(board, this.bitboards, settings);
    } else {
      const best = findBestMove(board, this.bitboards, settings.depth, settings);
      move = best && best.move;
    }

    if (!move) {
      move = fallbackMove(board);
    }

    if (!move) {
      this.setData({
        message: 'AI 无子可落，平局结束',
        gameOver: true,
        isPlayerTurn: false
      });
      return;
    }

    board[move.row][move.col] = AI_PLAYER;
    setStone(this.bitboards, move.row, move.col, AI_PLAYER);
    this.history.push({ row: move.row, col: move.col, player: AI_PLAYER });

    if (checkWin(board, move.row, move.col, AI_PLAYER)) {
      this.setData({
        board,
        lastMove: move,
        gameOver: true,
        isPlayerTurn: false,
        hintMove: null,
        canUndo: this.history.length >= 2,
        message: 'AI 获胜，下次再接再厉！'
      });
      return;
    }

    if (isBoardFull(board)) {
      this.setData({
        board,
        lastMove: move,
        gameOver: true,
        isPlayerTurn: false,
        hintMove: null,
        canUndo: this.history.length >= 2,
        message: '棋盘已满，平局结束'
      });
      return;
    }

    this.setData({
      board,
      lastMove: move,
      isPlayerTurn: true,
      hintMove: null,
      canUndo: this.history.length >= 2,
      message: '轮到你落子'
    });
  },

  undoMove() {
    if (this.data.isOnlineMode || this.history.length === 0) {
      return;
    }

    const steps = Math.min(2, this.history.length);
    const board = cloneBoard(this.data.board);

    for (let i = 0; i < steps; i += 1) {
      const move = this.history.pop();
      board[move.row][move.col] = EMPTY;
      clearStone(this.bitboards, move.row, move.col, move.player);
    }

    const last = this.history[this.history.length - 1] || null;
    this.setData({
      board,
      lastMove: last ? { row: last.row, col: last.col } : null,
      gameOver: false,
      isPlayerTurn: true,
      hintMove: null,
      canUndo: this.history.length >= 2,
      message: '已悔棋，请继续落子'
    });
  },

  showHint() {
    if (this.data.isOnlineMode || this.data.gameOver || !this.data.isPlayerTurn) {
      return;
    }

    const board = cloneBoard(this.data.board);
    const settings = getCurrentDifficulty(this.data.difficultyIndex);
    const move = findBestMoveForPlayer(board, this.bitboards, HUMAN_PLAYER, settings);
    if (!move) {
      this.setData({ hintMove: null, message: '暂无明显优势落点，请谨慎出招' });
      return;
    }

    this.setData({
      hintMove: move,
      message: `推荐落子：(${move.row + 1}, ${move.col + 1})`
    });
  },

  async returnToLobby() {
    if (this.data.isOnlineMode && this.data.onlineRoomId) {
      await this.leaveRoom({ silent: true });
    }
    const stack = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (stack && stack.length > 1) {
      wx.navigateBack({ delta: 1 });
    } else {
      wx.reLaunch({ url: '/pages/home/home' });
    }
  },

  async createRoom() {
    if (!this.data.isOnlineMode) {
      return;
    }
    const db = await this.ensureDatabase();
    if (!db) {
      return;
    }

    this.setData({ onlineLoading: true, onlineMessage: '创建房间中...' });
    const board = createEmptyBoard();
    const roomCode = generateRoomCode();

    try {
      const res = await db.collection('rooms').add({
        data: {
          code: roomCode,
          board,
          moves: [],
          turn: 'black',
          players: {
            black: { ready: true },
            white: null
          },
          lastMove: null,
          winner: null,
          updatedAt: Date.now()
        }
      });

      this.onlinePlayerRole = 'black';
      this.onlineDocId = res._id;
      this.history = [];
      this.bitboards = createEmptyBitboards();
      this.setData({
        board,
        onlineRoomId: roomCode,
        onlineLoading: false,
        onlineOpponentReady: false,
        onlineMessage: '房间创建成功，房间号已生成',
        onlineCanAct: true,
        gameOver: false,
        lastMove: null,
        message: '在线模式：轮到你落子',
        hintMove: null,
        canUndo: false,
        isPlayerTurn: true
      });

      this.setupRoomWatcher(res._id);
    } catch (error) {
      console.error('createRoom error', error);
      this.setData({
        onlineLoading: false,
        onlineMessage: '创建房间失败，请稍后重试'
      });
    }
  },

  handleJoinRoomInput(event) {
    this.setData({ joinRoomCode: event.detail.value.toUpperCase() });
  },

  async joinRoom() {
    if (!this.data.isOnlineMode) {
      return;
    }
    const code = (this.data.joinRoomCode || '').trim().toUpperCase();
    if (!code) {
      this.setData({ onlineMessage: '请输入有效的房间号' });
      return;
    }

    const db = await this.ensureDatabase();
    if (!db) {
      return;
    }

    this.setData({ onlineLoading: true, onlineMessage: '搜索房间...' });

    try {
      const res = await db.collection('rooms').where({ code }).get();
      if (!res.data || res.data.length === 0) {
        this.setData({ onlineLoading: false, onlineMessage: '未找到对应房间，请确认房间号' });
        return;
      }

      const room = res.data[0];
      if (room.winner) {
        this.setData({ onlineLoading: false, onlineMessage: '房间对局已结束，请创建新房间' });
        return;
      }
      if (room.players && room.players.white && room.players.white.ready) {
        this.setData({ onlineLoading: false, onlineMessage: '房间人数已满' });
        return;
      }

      await db.collection('rooms').doc(room._id).update({
        data: {
          'players.white': { ready: true },
          updatedAt: Date.now()
        }
      });

      this.onlinePlayerRole = 'white';
      this.onlineDocId = room._id;
      this.history = room.moves || [];
      this.bitboards = rebuildBitboardsFromBoard(room.board || createEmptyBoard());
      const board = room.board || createEmptyBoard();
      const onlineCanAct = room.turn === 'white';

      this.setData({
        board,
        onlineRoomId: code,
        onlineLoading: false,
        onlineOpponentReady: !!(room.players && room.players.black && room.players.black.ready),
        onlineMessage: '成功加入房间，等待对手落子',
        onlineCanAct,
        gameOver: !!room.winner,
        lastMove: room.lastMove || null,
        message: onlineCanAct ? '在线模式：轮到你落子' : '在线模式：等待对手落子',
        hintMove: null,
        canUndo: false,
        isPlayerTurn: onlineCanAct
      });

      this.setupRoomWatcher(room._id);
    } catch (error) {
      console.error('joinRoom error', error);
      this.setData({ onlineLoading: false, onlineMessage: '加入房间失败，请稍后重试' });
    }
  },

  async leaveRoom(options = {}) {
    if (!this.data.onlineRoomId) {
      return Promise.resolve();
    }

    const db = await this.ensureDatabase();
    const docId = this.onlineDocId;
    const role = this.onlinePlayerRole;
    this.teardownWatcher();
    this.onlineDocId = null;

    if (db && docId) {
      const updates = { updatedAt: Date.now() };
      if (role === 'black') {
        updates.status = 'closed';
      } else {
        updates['players.white'] = null;
      }
      db.collection('rooms').doc(docId).update({ data: updates }).catch(() => {});
    }

    this.history = [];
    this.bitboards = createEmptyBitboards();

    this.setData({
      board: createEmptyBoard(),
      onlineRoomId: '',
      onlineOpponentReady: false,
      onlineCanAct: false,
      gameOver: false,
      lastMove: null,
      hintMove: null,
      canUndo: false,
      message: options.silent ? this.data.message : '已退出房间',
      onlineMessage: options.silent ? this.data.onlineMessage : '已退出房间'
    });
  },

  async handleOnlineCellTap(row, col) {
    if (!this.data.isOnlineMode || this.data.gameOver || !this.data.onlineCanAct || this.data.onlineLoading) {
      return;
    }

    const board = cloneBoard(this.data.board);
    if (board[row][col] !== EMPTY) {
      return;
    }

    const playerNumber = this.onlinePlayerRole === 'black' ? HUMAN_PLAYER : AI_PLAYER;
    board[row][col] = playerNumber;
    setStone(this.bitboards, row, col, playerNumber);

    const move = {
      row,
      col,
      role: this.onlinePlayerRole,
      player: playerNumber,
      timestamp: Date.now()
    };

    const winner = checkWin(board, row, col, playerNumber) ? this.onlinePlayerRole : null;
    const draw = !winner && isBoardFull(board);

    this.history.push(move);

    this.setData({
      board,
      lastMove: { row, col },
      onlineCanAct: false,
      isPlayerTurn: false,
      hintMove: null,
      canUndo: false,
      message: winner ? '落子已提交，判定胜负中' : '已落子，等待对手回应'
    });

    await this.syncMoveToCloud(board, move, winner, draw);
  },

  async syncMoveToCloud(board, move, winner, draw) {
    const db = await this.ensureDatabase();
    if (!db || !this.onlineDocId) {
      return;
    }
    const _ = db.command;
    const nextTurn = winner || draw ? null : (this.onlinePlayerRole === 'black' ? 'white' : 'black');
    const data = {
      board,
      lastMove: move,
      moves: _.push(move),
      turn: nextTurn,
      winner: winner ? this.onlinePlayerRole : (draw ? 'draw' : null),
      updatedAt: Date.now()
    };
    if (!winner && !draw) {
      delete data.winner;
    }

    try {
      await db.collection('rooms').doc(this.onlineDocId).update({ data });
      this.setData({
        onlineMessage: winner ? '胜负结果已同步' : '落子已同步，等待对手',
        gameOver: !!(winner || draw),
        message: winner ? (winner === this.onlinePlayerRole ? '你获胜啦！' : '等待系统确认') : (draw ? '双方平局，等待确认' : '等待对手落子')
      });
    } catch (error) {
      console.error('syncMove error', error);
      this.setData({ onlineMessage: '同步失败，请检查网络后重试' });
      // 回滚本地状态
      const last = this.history.pop();
      if (last) {
        const rollbackBoard = cloneBoard(this.data.board);
        rollbackBoard[move.row][move.col] = EMPTY;
        clearStone(this.bitboards, move.row, move.col, move.player);
        this.setData({ board: rollbackBoard, lastMove: null, onlineCanAct: true, isPlayerTurn: true });
      }
    }
  },

  async setupRoomWatcher(docId) {
    const db = await this.ensureDatabase();
    if (!db) {
      return;
    }
    this.teardownWatcher();
    try {
      this.roomWatcher = db.collection('rooms').doc(docId).watch({
        onChange: snapshot => {
          if (!snapshot || !snapshot.docs || snapshot.docs.length === 0) {
            return;
          }
          this.handleRoomSnapshot(snapshot.docs[0]);
        },
        onError: error => {
          console.error('room watch error', error);
          this.setData({ onlineMessage: '实时连接断开，请尝试重新进入房间' });
        }
      });
    } catch (error) {
      console.error('watch error', error);
      this.setData({ onlineMessage: '无法建立实时连接' });
    }
  },

  teardownWatcher() {
    if (this.roomWatcher && typeof this.roomWatcher.close === 'function') {
      this.roomWatcher.close();
    }
    this.roomWatcher = null;
  },

  handleRoomSnapshot(room) {
    if (!room) {
      return;
    }

    const board = room.board || createEmptyBoard();
    const winner = room.winner;
    const turn = room.turn;
    const opponentReady = !!(room.players && room.players.white && room.players.white.ready && room.players.black && room.players.black.ready);
    const onlineCanAct = !winner && turn === this.onlinePlayerRole;

    this.history = room.moves || [];
    this.bitboards = rebuildBitboardsFromBoard(board);

    let message = '';
    if (winner === 'draw') {
      message = '对局结束：平局';
    } else if (winner) {
      message = winner === this.onlinePlayerRole ? '恭喜，你赢了！' : '很遗憾，对手获胜';
    } else {
      message = onlineCanAct ? '轮到你落子' : '等待对手落子';
    }

    this.setData({
      board,
      lastMove: room.lastMove || null,
      onlineOpponentReady: opponentReady,
      onlineCanAct,
      gameOver: !!winner,
      isPlayerTurn: onlineCanAct,
      message,
      onlineMessage: winner ? `对局结束：${winner === 'draw' ? '平局' : (winner === 'black' ? '黑方胜' : '白方胜')}` : `当前轮到${turn === this.onlinePlayerRole ? '你' : '对手'}落子`,
      hintMove: null,
      canUndo: false
    });
  },

  async ensureDatabase() {
    if (!wx.cloud) {
      wx.showToast({ title: '请使用基础库 2.2.3 以上版本', icon: 'none' });
      this.setData({ onlineMessage: '当前基础库不支持云开发功能' });
      return null;
    }
    if (!this.db) {
      try {
        if (!this.cloudInited) {
          wx.cloud.init({ env: CLOUD_ENV_ID || undefined, traceUser: true });
          this.cloudInited = true;
        }
        this.db = wx.cloud.database();
      } catch (error) {
        console.error('init cloud error', error);
        this.setData({ onlineMessage: '云开发初始化失败，请检查配置' });
        return null;
      }
    }
    return this.db;
  }
});

function createEmptyBoard() {
  const board = new Array(BOARD_SIZE);
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    board[i] = new Array(BOARD_SIZE).fill(EMPTY);
  }
  return board;
}

function cloneBoard(board) {
  return board.map(row => row.slice());
}

function createEmptyBitboards() {
  return {
    [AI_PLAYER]: new Array(BITBOARD_SEGMENTS).fill(0n),
    [HUMAN_PLAYER]: new Array(BITBOARD_SEGMENTS).fill(0n)
  };
}

function cloneBitboards(bitboards) {
  return {
    [AI_PLAYER]: bitboards[AI_PLAYER].map(item => BigInt(item)),
    [HUMAN_PLAYER]: bitboards[HUMAN_PLAYER].map(item => BigInt(item))
  };
}

function toIndex(row, col) {
  return row * BOARD_SIZE + col;
}

function getSegmentAndOffset(index) {
  const segment = Math.floor(index / SEGMENT_SIZE);
  const offset = index % SEGMENT_SIZE;
  return { segment, offset };
}

function setStone(bitboards, row, col, player) {
  const index = toIndex(row, col);
  const { segment, offset } = getSegmentAndOffset(index);
  const mask = 1n << BigInt(offset);
  bitboards[player][segment] |= mask;
}

function clearStone(bitboards, row, col, player) {
  const index = toIndex(row, col);
  const { segment, offset } = getSegmentAndOffset(index);
  const mask = 1n << BigInt(offset);
  bitboards[player][segment] &= ~mask;
}

function hasStone(bitboards, row, col, player) {
  const index = toIndex(row, col);
  const { segment, offset } = getSegmentAndOffset(index);
  const mask = 1n << BigInt(offset);
  return (bitboards[player][segment] & mask) !== 0n;
}

function occupantAt(bitboards, row, col) {
  if (hasStone(bitboards, row, col, AI_PLAYER)) {
    return AI_PLAYER;
  }
  if (hasStone(bitboards, row, col, HUMAN_PLAYER)) {
    return HUMAN_PLAYER;
  }
  return EMPTY;
}

function rebuildBitboardsFromBoard(board) {
  const bitboards = createEmptyBitboards();
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const player = board[row][col];
      if (player === AI_PLAYER || player === HUMAN_PLAYER) {
        setStone(bitboards, row, col, player);
      }
    }
  }
  return bitboards;
}

function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function checkWin(board, row, col, player) {
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;

    let r = row + dr;
    let c = col + dc;
    while (isInside(r, c) && board[r][c] === player) {
      count += 1;
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (isInside(r, c) && board[r][c] === player) {
      count += 1;
      r -= dr;
      c -= dc;
    }

    if (count >= WIN_COUNT) {
      return true;
    }
  }
  return false;
}

function isBoardFull(board) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] === EMPTY) {
        return false;
      }
    }
  }
  return true;
}

function computeLines() {
  const lines = [];

  // Horizontal
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    const line = [];
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      line.push(toIndex(row, col));
    }
    lines.push(line);
  }

  // Vertical
  for (let col = 0; col < BOARD_SIZE; col += 1) {
    const line = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      line.push(toIndex(row, col));
    }
    lines.push(line);
  }

  // Diagonal ↘
  for (let row = 0; row <= BOARD_SIZE - WIN_COUNT; row += 1) {
    for (let col = 0; col <= BOARD_SIZE - WIN_COUNT; col += 1) {
      const line = [];
      for (let k = 0; k < BOARD_SIZE - Math.max(row, col); k += 1) {
        line.push(toIndex(row + k, col + k));
      }
      lines.push(line);
    }
  }

  // Diagonal ↗
  for (let row = WIN_COUNT - 1; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col <= BOARD_SIZE - WIN_COUNT; col += 1) {
      const line = [];
      for (let k = 0; row - k >= 0 && col + k < BOARD_SIZE; k += 1) {
        line.push(toIndex(row - k, col + k));
      }
      lines.push(line);
    }
  }

  return lines;
}

function evaluateBoard(board, bitboards) {
  const aiScore = evaluatePlayer(bitboards, AI_PLAYER);
  if (aiScore >= WIN_SCORE) {
    return WIN_SCORE;
  }
  const humanScore = evaluatePlayer(bitboards, HUMAN_PLAYER);
  if (humanScore >= WIN_SCORE) {
    return -WIN_SCORE;
  }
  return aiScore - humanScore;
}

function evaluatePlayer(bitboards, player) {
  const opponent = player === AI_PLAYER ? HUMAN_PLAYER : AI_PLAYER;
  let score = 0;

  for (const line of LINES) {
    let i = 0;
    while (i < line.length) {
      const index = line[i];
      const row = Math.floor(index / BOARD_SIZE);
      const col = index % BOARD_SIZE;
      if (!hasStone(bitboards, row, col, player)) {
        i += 1;
        continue;
      }

      let count = 0;
      let start = i;
      while (i < line.length) {
        const idx = line[i];
        const r = Math.floor(idx / BOARD_SIZE);
        const c = idx % BOARD_SIZE;
        if (hasStone(bitboards, r, c, player)) {
          count += 1;
          i += 1;
        } else {
          break;
        }
      }

      if (count >= WIN_COUNT) {
        return WIN_SCORE;
      }

      const beforeIndex = start - 1 >= 0 ? line[start - 1] : null;
      const afterIndex = i < line.length ? line[i] : null;

      const forwardOpen = beforeIndex !== null && occupantAt(bitboards, Math.floor(beforeIndex / BOARD_SIZE), beforeIndex % BOARD_SIZE) === EMPTY;
      const backwardOpen = afterIndex !== null && occupantAt(bitboards, Math.floor(afterIndex / BOARD_SIZE), afterIndex % BOARD_SIZE) === EMPTY;
      const openEnds = (forwardOpen ? 1 : 0) + (backwardOpen ? 1 : 0);

      if (openEnds === 0) {
        continue;
      }

      switch (count) {
        case 4:
          score += openEnds === 2 ? PATTERN_SCORES.openFour : PATTERN_SCORES.closedFour;
          break;
        case 3:
          score += openEnds === 2 ? PATTERN_SCORES.openThree : PATTERN_SCORES.closedThree;
          break;
        case 2:
          score += openEnds === 2 ? PATTERN_SCORES.openTwo : PATTERN_SCORES.closedTwo;
          break;
        case 1:
          score += PATTERN_SCORES.single;
          break;
        default:
          score += count * 4;
          break;
      }
    }

    // 拦截对手的四连冲四
    let j = 0;
    while (j < line.length) {
      const indexOpponent = line[j];
      const rowO = Math.floor(indexOpponent / BOARD_SIZE);
      const colO = indexOpponent % BOARD_SIZE;
      if (!hasStone(bitboards, rowO, colO, opponent)) {
        j += 1;
        continue;
      }

      let countO = 0;
      let startO = j;
      while (j < line.length) {
        const idx = line[j];
        const r = Math.floor(idx / BOARD_SIZE);
        const c = idx % BOARD_SIZE;
        if (hasStone(bitboards, r, c, opponent)) {
          countO += 1;
          j += 1;
        } else {
          break;
        }
      }

      const beforeOpponent = startO - 1 >= 0 ? line[startO - 1] : null;
      const afterOpponent = j < line.length ? line[j] : null;
      const forwardBlock = beforeOpponent !== null && occupantAt(bitboards, Math.floor(beforeOpponent / BOARD_SIZE), beforeOpponent % BOARD_SIZE) === EMPTY;
      const backwardBlock = afterOpponent !== null && occupantAt(bitboards, Math.floor(afterOpponent / BOARD_SIZE), afterOpponent % BOARD_SIZE) === EMPTY;
      const blockEnds = (forwardBlock ? 1 : 0) + (backwardBlock ? 1 : 0);

      if (countO === 4 && blockEnds > 0) {
        score += PATTERN_SCORES.closedFour / 2;
      }
    }
  }

  return score;
}

function generateCandidates(board) {
  const points = new Set();
  let hasStone = false;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] !== EMPTY) {
        hasStone = true;
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            const nr = row + dr;
            const nc = col + dc;
            if (!isInside(nr, nc) || board[nr][nc] !== EMPTY) {
              continue;
            }
            points.add(`${nr},${nc}`);
          }
        }
      }
    }
  }

  if (!hasStone) {
    const center = Math.floor(BOARD_SIZE / 2);
    return [{ row: center, col: center }];
  }

  return Array.from(points).map(item => {
    const [row, col] = item.split(',').map(Number);
    return { row, col };
  });
}

function orderCandidates(board, bitboards, candidates, player, limit = 12) {
  const scored = candidates.map(move => {
    board[move.row][move.col] = player;
    setStone(bitboards, move.row, move.col, player);
    const score = evaluateBoard(board, bitboards);
    board[move.row][move.col] = EMPTY;
    clearStone(bitboards, move.row, move.col, player);
    return { move, score };
  });

  scored.sort((a, b) => {
    if (player === AI_PLAYER) {
      return b.score - a.score;
    }
    return a.score - b.score;
  });

  return scored
    .slice(0, limit)
    .map(item => item.move);
}

function fallbackMove(board) {
  const candidates = generateCandidates(board);
  if (candidates.length === 0) {
    return null;
  }
  return candidates[0];
}

function getCurrentDifficulty(index) {
  return DIFFICULTY_SETTINGS[index] || DIFFICULTY_SETTINGS[0];
}

function findBestMove(board, bitboards, depth, settings) {
  const candidates = orderCandidates(board, bitboards, generateCandidates(board), AI_PLAYER, settings.candidateLimit);
  let bestScore = -Infinity;
  let bestMove = null;

  for (const move of candidates) {
    board[move.row][move.col] = AI_PLAYER;
    setStone(bitboards, move.row, move.col, AI_PLAYER);
    const score = minimax(board, bitboards, depth - 1, -Infinity, Infinity, false, { row: move.row, col: move.col, player: AI_PLAYER }, settings);
    board[move.row][move.col] = EMPTY;
    clearStone(bitboards, move.row, move.col, AI_PLAYER);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return { score: bestScore, move: bestMove };
}

function findBestMoveForPlayer(board, bitboards, player, settings) {
  const perspective = player === AI_PLAYER ? HUMAN_PLAYER : AI_PLAYER;
  const candidates = orderCandidates(board, bitboards, generateCandidates(board), player, settings.candidateLimit);
  let bestScore = -Infinity;
  let bestMove = null;

  for (const move of candidates) {
    board[move.row][move.col] = player;
    setStone(bitboards, move.row, move.col, player);
    const score = minimax(board, bitboards, settings.depth - 1, -Infinity, Infinity, false, { row: move.row, col: move.col, player }, settings);
    board[move.row][move.col] = EMPTY;
    clearStone(bitboards, move.row, move.col, player);

    const adjustedScore = player === HUMAN_PLAYER ? score : -score;
    if (adjustedScore > bestScore) {
      bestScore = adjustedScore;
      bestMove = move;
    }
  }

  return bestMove;
}

function minimax(board, bitboards, depth, alpha, beta, maximizingPlayer, lastMove, settings) {
  if (lastMove) {
    if (checkWin(board, lastMove.row, lastMove.col, lastMove.player)) {
      const delta = depth + 1;
      if (lastMove.player === AI_PLAYER) {
        return WIN_SCORE - 10 * delta;
      }
      return -WIN_SCORE + 10 * delta;
    }
  }

  if (depth === 0 || isBoardFull(board)) {
    return evaluateBoard(board, bitboards);
  }

  const player = maximizingPlayer ? AI_PLAYER : HUMAN_PLAYER;
  const candidates = orderCandidates(board, bitboards, generateCandidates(board), player, settings.candidateLimit);

  if (candidates.length === 0) {
    return evaluateBoard(board, bitboards);
  }

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of candidates) {
      board[move.row][move.col] = AI_PLAYER;
      setStone(bitboards, move.row, move.col, AI_PLAYER);
      const evalScore = minimax(board, bitboards, depth - 1, alpha, beta, false, { row: move.row, col: move.col, player: AI_PLAYER }, settings);
      board[move.row][move.col] = EMPTY;
      clearStone(bitboards, move.row, move.col, AI_PLAYER);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) {
        break;
      }
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of candidates) {
    board[move.row][move.col] = HUMAN_PLAYER;
    setStone(bitboards, move.row, move.col, HUMAN_PLAYER);
    const evalScore = minimax(board, bitboards, depth - 1, alpha, beta, true, { row: move.row, col: move.col, player: HUMAN_PLAYER }, settings);
    board[move.row][move.col] = EMPTY;
    clearStone(bitboards, move.row, move.col, HUMAN_PLAYER);
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) {
      break;
    }
  }
  return minEval;
}

function mctsSearch(board, bitboards, settings) {
  const candidates = orderCandidates(board, bitboards, generateCandidates(board), AI_PLAYER, settings.candidateLimit);
  if (candidates.length === 0) {
    return null;
  }

  const iterations = Math.max(settings.mctsIterations || 800, candidates.length * 20);
  const stats = candidates.map(move => ({ move, wins: 0, sims: 0 }));

  for (const item of stats) {
    const perCandidate = Math.max(1, Math.floor(iterations / stats.length));
    for (let i = 0; i < perCandidate; i += 1) {
      const result = simulatePlayout(board, bitboards, item.move, AI_PLAYER);
      item.sims += 1;
      item.wins += result;
    }
  }

  stats.sort((a, b) => (b.wins / b.sims) - (a.wins / a.sims));
  return stats[0].move;
}

function simulatePlayout(board, bitboards, firstMove, firstPlayer) {
  const boardCopy = cloneBoard(board);
  const bitboardsCopy = cloneBitboards(bitboards);
  let currentPlayer = firstPlayer;
  let move = firstMove;
  let steps = 0;

  boardCopy[move.row][move.col] = currentPlayer;
  setStone(bitboardsCopy, move.row, move.col, currentPlayer);
  if (checkWin(boardCopy, move.row, move.col, currentPlayer)) {
    return currentPlayer === AI_PLAYER ? 1 : 0;
  }

  currentPlayer = switchPlayer(currentPlayer);

  while (steps < MONTE_CARLO_PLAYOUT_DEPTH) {
    const candidates = generateCandidates(boardCopy);
    if (candidates.length === 0) {
      break;
    }
    const randomMove = candidates[Math.floor(Math.random() * candidates.length)];
    boardCopy[randomMove.row][randomMove.col] = currentPlayer;
    setStone(bitboardsCopy, randomMove.row, randomMove.col, currentPlayer);
    if (checkWin(boardCopy, randomMove.row, randomMove.col, currentPlayer)) {
      return currentPlayer === AI_PLAYER ? 1 : 0;
    }
    if (isBoardFull(boardCopy)) {
      return 0.5;
    }
    currentPlayer = switchPlayer(currentPlayer);
    steps += 1;
  }

  return 0.5;
}

function switchPlayer(player) {
  return player === AI_PLAYER ? HUMAN_PLAYER : AI_PLAYER;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
