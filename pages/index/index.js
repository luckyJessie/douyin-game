const app = getApp();
const globalData = (app && app.globalData) || {};
const {
  PLAYER_BLACK,
  PLAYER_WHITE,
  createEmptyBoard,
  cloneBoard,
  hasEmptyCell,
  checkWinner,
  findBestMove
} = require("../../utils/gomoku");

const BOARD_SIZE = globalData.boardSize || 15;
const HUMAN_PLAYER = PLAYER_BLACK;
const AI_PLAYER = PLAYER_WHITE;

Page({
  aiTimer: null,
  data: {
    board: [],
    currentPlayer: HUMAN_PLAYER,
    winner: null,
    statusText: "黑棋先手，请落子",
    history: [],
    lastMove: null,
    canUndo: false,
    isAiThinking: false
  },

  onLoad() {
    this.resetBoard();
  },

  resetBoard() {
    this.clearAiTimer();
    this.setData({
      board: createEmptyBoard(BOARD_SIZE),
      currentPlayer: HUMAN_PLAYER,
      winner: null,
      statusText: "黑棋先手，请落子",
      history: [],
      lastMove: null,
      canUndo: false,
      isAiThinking: false
    });
  },

  handleCellTap(event) {
    if (this.data.isAiThinking || this.data.currentPlayer !== HUMAN_PLAYER) {
      return;
    }

    const { row, col } = event.currentTarget.dataset;
    if (this.data.winner || row === undefined || col === undefined) {
      return;
    }

    const r = Number(row);
    const c = Number(col);
    const currentBoard = cloneBoard(this.data.board);

    if (currentBoard[r][c]) {
      return;
    }

    const player = this.data.currentPlayer;
    currentBoard[r][c] = player;

    const newHistory = this.data.history.concat({
      row: r,
      col: c,
      player
    });

    const winner = checkWinner(currentBoard, r, c, player);
    const hasEmpty = hasEmptyCell(currentBoard);
    let statusText;
    let nextPlayer = AI_PLAYER;

    if (winner) {
      statusText = `${player === PLAYER_BLACK ? "黑棋" : "白棋"}胜出！`;
    } else if (!hasEmpty) {
      statusText = "棋盘已满，和局！";
      nextPlayer = this.data.currentPlayer;
    } else {
      statusText = "豆芽助手思考中…";
    }

    this.setData({
      board: currentBoard,
      currentPlayer: winner || !hasEmpty ? this.data.currentPlayer : nextPlayer,
      winner: winner ? player : null,
      statusText,
      history: newHistory,
      lastMove: { row: r, col: c },
      canUndo: newHistory.length > 0,
      isAiThinking: !winner && hasEmpty
    });

    if (!winner && hasEmpty) {
      this.triggerAiMove();
    }
  },

  handleRestart() {
    this.clearAiTimer();
    wx.showModal({
      title: "重新开局",
      content: "确定要开始新的对局吗？",
      confirmText: "确认",
      cancelText: "取消",
      success: (res) => {
        if (res.confirm) {
          this.resetBoard();
        }
      }
    });
  },

  handleUndo() {
    if (this.data.isAiThinking) {
      wx.showToast({
        title: "等待电脑落子",
        icon: "none"
      });
      return;
    }

    const history = [...this.data.history];
    if (!history.length) {
      return;
    }

    const lastStep = history.pop();
    const board = cloneBoard(this.data.board);
    board[lastStep.row][lastStep.col] = "";

    if (history.length) {
      const previousStep = history.pop();
      board[previousStep.row][previousStep.col] = "";
    }

    const preStep = history[history.length - 1] || null;
    const statusText = history.length ? "黑棋请落子" : "黑棋先手，请落子";

    this.setData({
      board,
      currentPlayer: HUMAN_PLAYER,
      winner: null,
      statusText,
      history,
      lastMove: preStep ? { row: preStep.row, col: preStep.col } : null,
      canUndo: history.length > 0,
      isAiThinking: false
    });
  },

  triggerAiMove() {
    this.clearAiTimer();
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;

      if (this.data.winner) {
        this.setData({ isAiThinking: false });
        return;
      }

      const currentBoard = cloneBoard(this.data.board);
      const move = findBestMove(currentBoard, AI_PLAYER, HUMAN_PLAYER);

      if (!move) {
        this.setData({
          statusText: "棋盘已满，和局！",
          currentPlayer: HUMAN_PLAYER,
          isAiThinking: false
        });
        return;
      }

      const { row, col } = move;
      currentBoard[row][col] = AI_PLAYER;

      const history = this.data.history.concat({
        row,
        col,
        player: AI_PLAYER
      });

      const winner = checkWinner(currentBoard, row, col, AI_PLAYER);
      const hasEmpty = hasEmptyCell(currentBoard);
      let statusText;

      if (winner) {
        statusText = "白棋胜出！";
      } else if (!hasEmpty) {
        statusText = "棋盘已满，和局！";
      } else {
        statusText = "黑棋请落子";
      }

      this.setData({
        board: currentBoard,
        currentPlayer: winner || !hasEmpty ? this.data.currentPlayer : HUMAN_PLAYER,
        winner: winner ? AI_PLAYER : null,
        statusText,
        history,
        lastMove: { row, col },
        canUndo: history.length > 0,
        isAiThinking: false
      });
    }, 400);
  },

  clearAiTimer() {
    if (this.aiTimer) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  },

  onUnload() {
    this.clearAiTimer();
  }
});
