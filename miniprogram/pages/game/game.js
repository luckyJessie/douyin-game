const {
  BOARD_SIZE,
  PLAYER,
  CELL
} = require('../../core/constants');
const {
  createBoard,
  cloneBoard,
  applyMove,
  revertMove,
  checkWin,
  isBoardFull
} = require('../../core/board');
const { findBestMove } = require('../../core/search');
const { MatchService } = require('../../services/matchService');
const { DIFFICULTY_SETTINGS } = require('../../utils/settings');
const { CLOUD_ENV_ID } = require('../../config/index');

const difficultyPresets = DIFFICULTY_SETTINGS;

const linePositions = Array.from({ length: BOARD_SIZE }, (_, index) =>
  Number(((index / (BOARD_SIZE - 1)) * 100).toFixed(4))
);

const starPoints = [
  { row: 3, col: 3 },
  { row: 3, col: BOARD_SIZE - 4 },
  { row: BOARD_SIZE - 4, col: 3 },
  { row: BOARD_SIZE - 4, col: BOARD_SIZE - 4 },
  { row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) }
];

const starPointsMap = starPoints.reduce((acc, point) => {
  acc[`${point.row}-${point.col}`] = true;
  return acc;
}, {});

const DEFAULT_TOAST = {
  visible: false,
  variant: 'player',
  title: '',
  message: '',
  actionText: '再来一局'
};

Page({
  data: {
    board: createBoard(),
    boardSize: BOARD_SIZE,
    linePositions,
    starPoints,
    starPointsMap,
    message: '玩家先手，请落子',
    isPlayerTurn: true,
    gameOver: false,
    playerFirst: true,
    lastMove: null,
    hintMove: null,
    canUndo: false,
    difficultyIndex: 1,
    difficultyLabel: difficultyPresets[1].label,
    isOnlineMode: false,
    onlineRoomId: '',
    onlineOpponentReady: false,
    onlineLoading: false,
    onlineMessage: '',
    onlineCanAct: false,
    joinRoomCode: '',
    AI_PLAYER: PLAYER.AI,
    HUMAN_PLAYER: PLAYER.HUMAN,
    winToast: { ...DEFAULT_TOAST }
  },

  async onLoad(options) {
    this.boardState = createBoard();
    this.history = [];
    this.matchService = null;
    this.aiTimer = null;
    this.db = null;
    this.cloudInited = false;
    this.cloudEnvId = CLOUD_ENV_ID;
    this.onlineRole = 'black';

    const mode = options?.mode === 'online' ? 'online' : 'local';
    const difficultyIndex = normalizeDifficulty(Number(options?.difficulty));
    const playerFirst = options?.first === 'ai' ? false : true;

    this.setData({
      board: cloneBoard(this.boardState),
      difficultyIndex,
      difficultyLabel: difficultyPresets[difficultyIndex].label,
      playerFirst,
      isOnlineMode: mode === 'online',
      isPlayerTurn: mode === 'online' ? false : playerFirst,
      message:
        mode === 'online'
          ? '请创建或加入在线房间'
          : playerFirst
            ? '玩家先手，请落子'
            : 'AI 先手，正在思考...',
      gameOver: false,
      lastMove: null,
      hintMove: null,
      canUndo: false,
      onlineMessage: mode === 'online' ? '创建房间后等待对手进入' : '',
      winToast: { ...DEFAULT_TOAST }
    });

    if (mode === 'online') {
      this.onlineRole = playerFirst ? 'black' : 'white';
      await this.initOnlineMode();
    } else if (!playerFirst) {
      this.scheduleAiMove();
    }
  },

  onUnload() {
    this.cleanup();
  },

  cleanup() {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
    if (this.matchService) {
      this.matchService.stopWatch();
    }
  },

  scheduleAiMove() {
    if (this.data.gameOver) return;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.setData({ isPlayerTurn: false, message: 'AI 思考中...' });
    this.aiTimer = setTimeout(() => this.runAiMove(), 160);
  },

  runAiMove() {
    if (this.data.gameOver) return;
    const depth = difficultyPresets[this.data.difficultyIndex].depth;
    const result = findBestMove(this.boardState, depth);
    const target = result && Number.isInteger(result.row) ? result : {
      row: Math.floor(BOARD_SIZE / 2),
      col: Math.floor(BOARD_SIZE / 2)
    };

    if (!applyMove(this.boardState, target.row, target.col, PLAYER.AI)) {
      return;
    }

    this.history.push({ row: target.row, col: target.col, player: PLAYER.AI });
    this.refreshBoard({
      lastMove: { row: target.row, col: target.col },
      canUndo: this.history.length >= 2
    });

    if (this.evaluateOutcome(PLAYER.AI, target.row, target.col)) {
      return;
    }

    this.setData({
      isPlayerTurn: true,
      message: '轮到你落子'
    });
  },

  handleCellTap(event) {
    const { row, col } = event.currentTarget.dataset;
    if (!Number.isInteger(row) || !Number.isInteger(col) || this.data.gameOver) {
      return;
    }

    if (this.data.isOnlineMode) {
      this.handleOnlineTap(row, col);
      return;
    }

    if (!this.data.isPlayerTurn || !applyMove(this.boardState, row, col, PLAYER.HUMAN)) {
      return;
    }

    this.history.push({ row, col, player: PLAYER.HUMAN });
    this.refreshBoard({
      lastMove: { row, col },
      canUndo: this.history.length >= 2,
      hintMove: null
    });

    if (this.evaluateOutcome(PLAYER.HUMAN, row, col)) {
      return;
    }

    this.scheduleAiMove();
  },

  evaluateOutcome(player, row, col) {
    if (checkWin(this.boardState, row, col, player)) {
      const variant = player === PLAYER.HUMAN ? 'player' : (this.data.isOnlineMode && player === this.getPlayerPiece()) ? 'player' : 'ai';
      const title = variant === 'player' ? '胜利！' : '对手获胜';
      const message = variant === 'player'
        ? (this.data.isOnlineMode ? '你赢下了本局，点击返回模式选择开始新对局。' : '你成功击败了对手，再试试更高难度！')
        : (this.data.isOnlineMode ? '对手赢得了本局，点击返回模式选择后可再次挑战。' : 'AI 更胜一筹，调整策略再战。');
      this.endGame({
        message: variant === 'player' ? '恭喜，你赢了！' : '对手获胜，下次再接再厉！',
        winToast: {
          visible: true,
          variant,
          title,
          message,
          actionText: this.data.isOnlineMode ? '返回模式选择' : '再来一局'
        }
      });
      return true;
    }

    if (isBoardFull(this.boardState)) {
      this.endGame({
        message: '棋盘已满，平局结束',
        winToast: {
          visible: true,
          variant: 'draw',
          title: '平局',
          message: this.data.isOnlineMode
            ? '棋局平分秋色，点击返回模式选择开启下一局。'
            : '旗鼓相当的一局！要不要再战一场？',
          actionText: this.data.isOnlineMode ? '返回模式选择' : '再来一局'
        }
      });
      return true;
    }

    return false;
  },

  endGame({ message, winToast }) {
    this.setData({
      board: cloneBoard(this.boardState),
      gameOver: true,
      isPlayerTurn: false,
      onlineCanAct: false,
      winToast: winToast || { ...DEFAULT_TOAST },
      message
    });
  },

  refreshBoard(extra = {}) {
    this.setData({
      board: cloneBoard(this.boardState),
      ...extra
    });
  },

  undoMove() {
    if (this.data.isOnlineMode || this.history.length === 0) return;

    const steps = Math.min(2, this.history.length);
    for (let i = 0; i < steps; i += 1) {
      const move = this.history.pop();
      revertMove(this.boardState, move.row, move.col);
    }
    const last = this.history[this.history.length - 1] || null;

    this.setData({
      board: cloneBoard(this.boardState),
      lastMove: last,
      hintMove: null,
      canUndo: this.history.length >= 2,
      gameOver: false,
      isPlayerTurn: true,
      message: '已悔棋，请继续落子'
    });
  },

  showHint() {
    if (this.data.isOnlineMode || this.data.gameOver || !this.data.isPlayerTurn) return;

    const depth = difficultyPresets[this.data.difficultyIndex].depth;
    const hint = computeHumanHint(this.boardState, depth);
    if (!hint) {
      this.setData({ hintMove: null, message: '暂无明显优势落点，请谨慎出招' });
      return;
    }

    this.setData({
      hintMove: hint,
      message: `推荐落子：(${hint.row + 1}, ${hint.col + 1})`
    });
  },

  async resetGame() {
    if (this.data.isOnlineMode) {
      wx.showToast({ title: '在线对战请通过创建/加入房间开始', icon: 'none' });
      return;
    }
    this.boardState = createBoard();
    this.history = [];
    this.setData({
      board: cloneBoard(this.boardState),
      gameOver: false,
      isPlayerTurn: this.data.playerFirst,
      lastMove: null,
      hintMove: null,
      canUndo: false,
      message: this.data.playerFirst ? '玩家先手，请落子' : 'AI 先手，正在思考...',
      winToast: { ...DEFAULT_TOAST }
    });
    if (!this.data.playerFirst) {
      this.scheduleAiMove();
    }
  },

  async initOnlineMode() {
    const db = await this.ensureDatabase();
    if (!db) return;
    this.matchService = new MatchService(db, this.cloudEnvId);
    this.boardState = createBoard();
    this.history = [];
    this.refreshBoard({
      message: '在线模式：请创建或加入房间',
      onlineMessage: '创建房间后分享房间号即可匹配好友',
      onlineRoomId: '',
      onlineOpponentReady: false,
      onlineCanAct: false,
      isPlayerTurn: false,
      winToast: { ...DEFAULT_TOAST }
    });
  },

  async createRoom() {
    if (!this.data.isOnlineMode || this.data.onlineLoading) return;
    const db = await this.ensureDatabase();
    if (!db) return;
    if (!this.matchService) this.matchService = new MatchService(db, this.cloudEnvId);

    const code = generateRoomCode();
    this.setData({ onlineLoading: true, onlineMessage: '创建房间中...' });
    try {
      const { id, board, code: roomCode } = await this.matchService.createRoom(code, this.onlineRole);
      this.boardState = board;
      this.history = [];
      this.watchRoom(id, this.onlineRole);
      this.refreshBoard({
        onlineRoomId: roomCode,
        onlineLoading: false,
        onlineMessage: '房间创建成功，等待对手加入',
        onlineOpponentReady: false,
        onlineCanAct: this.onlineRole === 'black',
        isPlayerTurn: this.onlineRole === 'black',
        message: this.onlineRole === 'black' ? '在线模式：等待对手加入' : '在线模式：等待对手落子',
        lastMove: null,
        hintMove: null,
        canUndo: false,
        winToast: { ...DEFAULT_TOAST }
      });
    } catch (error) {
      console.error('createRoom error', error);
      this.setData({ onlineLoading: false, onlineMessage: '创建房间失败，请稍后重试' });
    }
  },

  handleJoinRoomInput(event) {
    this.setData({ joinRoomCode: (event.detail.value || '').toUpperCase() });
  },

  async joinRoom() {
    if (!this.data.isOnlineMode || this.data.onlineLoading) return;
    if (!this.data.joinRoomCode) {
      wx.showToast({ title: '请输入房间号', icon: 'none' });
      return;
    }
    const db = await this.ensureDatabase();
    if (!db) return;
    if (!this.matchService) this.matchService = new MatchService(db, this.cloudEnvId);

    this.setData({ onlineLoading: true, onlineMessage: '正在搜索房间...' });
    try {
      const doc = await this.matchService.joinRoom(this.data.joinRoomCode, this.onlineRole);
      if (!doc) {
        this.setData({ onlineLoading: false, onlineMessage: '未找到房间，请确认房间号' });
        return;
      }
      this.boardState = doc.board || createBoard();
      this.history = doc.moves || [];
      this.watchRoom(doc._id, this.onlineRole);
      const canAct = doc.turn === this.onlineRole;
      this.refreshBoard({
        onlineRoomId: doc.code,
        onlineLoading: false,
        onlineOpponentReady: Boolean(doc.players?.black && doc.players?.white),
        onlineMessage: '成功加入房间，等待对手落子',
        onlineCanAct: canAct,
        isPlayerTurn: canAct,
        message: canAct ? '轮到你落子' : '等待对手落子',
        lastMove: doc.lastMove || null,
        canUndo: false,
        winToast: { ...DEFAULT_TOAST }
      });
    } catch (error) {
      console.error('joinRoom error', error);
      this.setData({ onlineLoading: false, onlineMessage: '加入房间失败，请稍后重试' });
    }
  },

  async leaveRoom(options = {}) {
    if (!this.data.isOnlineMode) return;
    if (this.matchService) {
      await this.matchService.leaveRoom(this.onlineRole);
    }
    this.boardState = createBoard();
    this.history = [];
    this.refreshBoard({
      onlineRoomId: '',
      onlineOpponentReady: false,
      onlineCanAct: false,
      joinRoomCode: '',
      isPlayerTurn: false,
      message: '已退出房间',
      onlineMessage: '创建房间后分享房间号即可匹配好友',
      winToast: { ...DEFAULT_TOAST }
    });
    if (!options.silent) {
      wx.showToast({ title: '已退出房间', icon: 'none' });
    }
  },

  handleOnlineTap(row, col) {
    if (!this.data.onlineCanAct || this.data.onlineLoading) return;
    if (!applyMove(this.boardState, row, col, this.getPlayerPiece())) return;

    this.history.push({ row, col, player: this.getPlayerPiece() });
    const boardSnapshot = cloneBoard(this.boardState);
    const winner = checkWin(this.boardState, row, col, this.getPlayerPiece())
      ? this.onlineRole
      : isBoardFull(this.boardState)
        ? 'draw'
        : null;

    this.refreshBoard({
      lastMove: { row, col },
      hintMove: null,
      canUndo: false,
      isPlayerTurn: false,
      onlineCanAct: false,
      message: winner
        ? (winner === 'draw' ? '棋局平分秋色，等待结果同步' : '落子成功，正在同步对局结果')
        : '已落子，等待对手回应'
    });

    if (this.matchService) {
      this.matchService
        .pushMove({
          row,
          col,
          role: this.onlineRole,
          player: this.getPlayerPiece(),
          board: boardSnapshot,
          winner
        })
        .catch(error => {
          console.error('push move failed', error);
          wx.showToast({ title: '同步失败，请稍后重试', icon: 'none' });
          revertMove(this.boardState, row, col);
          this.history.pop();
          this.refreshBoard({
            lastMove: null,
            onlineCanAct: true,
            isPlayerTurn: true,
            message: '同步失败，已回退落子'
          });
        });
    }
  },

  watchRoom(docId, role) {
    if (!this.matchService) return;
    this.matchService.watchRoom(docId, {
      onChange: doc => this.handleRoomSnapshot(doc, role),
      onError: () => {
        this.setData({ onlineMessage: '实时连接断开，请尝试重新进入房间' });
      }
    });
  },

  handleRoomSnapshot(doc, role) {
    if (!doc) return;
    this.boardState = doc.board || createBoard();
    const winner = doc.winner;
    const turn = doc.turn;
    const opponentReady = Boolean(doc.players?.black?.ready && doc.players?.white?.ready);
    const canAct = !winner && turn === role;
    const message = winner
      ? winner === 'draw'
        ? '对局结束：平局'
        : winner === role
          ? '你获胜啦！'
          : '对手获胜'
      : canAct
        ? '轮到你落子'
        : '等待对手落子';

    this.setData({
      board: cloneBoard(this.boardState),
      lastMove: doc.lastMove || null,
      onlineOpponentReady: opponentReady,
      onlineCanAct: canAct,
      isPlayerTurn: canAct,
      gameOver: Boolean(winner),
      message,
      onlineMessage: winner
        ? message
        : `当前轮到${turn === role ? '你' : '对手'}落子`
    });

    if (winner && !this.data.winToast.visible) {
      if (winner === 'draw') {
        this.showWinToast({
          variant: 'draw',
          title: '平局',
          message: '棋局平分秋色，点击返回模式选择开启下一局。',
          actionText: '返回模式选择'
        });
      } else if (winner === role) {
        this.showWinToast({
          variant: 'player',
          title: '胜利！',
          message: '你赢下了本局，点击返回模式选择开始新对局。',
          actionText: '返回模式选择'
        });
      } else {
        this.showWinToast({
          variant: 'ai',
          title: '对手获胜',
          message: '对手赢得了本局，点击返回模式选择后可再次挑战。',
          actionText: '返回模式选择'
        });
      }
    }
  },

  getPlayerPiece() {
    return this.onlineRole === 'black' ? PLAYER.HUMAN : PLAYER.AI;
  },

  async ensureDatabase() {
    if (!wx.cloud) {
      this.handleCloudUnavailable({
        notify: true,
        message: '当前基础库不支持云开发功能'
      });
      return null;
    }
    const envId =
      this.cloudEnvId ||
      (getApp && getApp().globalData && getApp().globalData.cloudEnvId) ||
      '';
    if (!envId) {
      this.handleCloudUnavailable({
        notify: true,
        message: '未配置云开发环境，已切换至本地模式'
      });
      return null;
    }
    if (!this.db) {
      try {
        if (!this.cloudInited) {
          wx.cloud.init({ env: envId, traceUser: true });
          this.cloudInited = true;
        }
        this.db = wx.cloud.database();
      } catch (error) {
        console.error('init cloud error', error);
        this.handleCloudUnavailable({
          notify: true,
          message: '云开发初始化失败，请检查配置'
        });
        return null;
      }
    }
    return this.db;
  },

  showWinToast(options) {
    const { variant, title, message, actionText } = options;
    this.setData({
      winToast: {
        visible: true,
        variant,
        title,
        message,
        actionText: actionText || (this.data.isOnlineMode ? '返回模式选择' : '再来一局')
      }
    });
  },

  handleToastAction() {
    if (this.data.isOnlineMode) {
      this.returnToLobby();
    } else {
      this.resetGame();
    }
  },

  async returnToLobby() {
    if (this.data.isOnlineMode) {
      await this.leaveRoom({ silent: true });
    }
    wx.reLaunch({ url: '/pages/home/home' });
  },

  handleCloudUnavailable({ notify = false, message } = {}) {
    if (notify) {
      wx.showToast({
        title: message || '云开发不可用，已切换至本地模式',
        icon: 'none'
      });
    }
    if (!this.data.isOnlineMode) return;
    this.cleanup();
    this.boardState = createBoard();
    this.history = [];
    this.setData({
      isOnlineMode: false,
      onlineRoomId: '',
      onlineOpponentReady: false,
      onlineLoading: false,
      onlineCanAct: false,
      joinRoomCode: '',
      message: '云开发不可用，已自动切换至本地人机模式',
      onlineMessage: message || '云开发不可用，已切换至本地模式',
      isPlayerTurn: true,
      playerFirst: true,
      board: cloneBoard(this.boardState),
      winToast: { ...DEFAULT_TOAST }
    });
  }
});

function normalizeDifficulty(index) {
  if (!Number.isInteger(index)) return 1;
  if (index < 0) return 0;
  if (index >= difficultyPresets.length) return difficultyPresets.length - 1;
  return index;
}

function computeHumanHint(board, depth) {
  const inverted = board.map(row =>
    row.map(cell => {
      if (cell === PLAYER.HUMAN) return PLAYER.AI;
      if (cell === PLAYER.AI) return PLAYER.HUMAN;
      return CELL.EMPTY;
    })
  );
  const suggestion = findBestMove(inverted, depth);
  return suggestion && Number.isInteger(suggestion.row)
    ? { row: suggestion.row, col: suggestion.col }
    : null;
}

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return code;
}
