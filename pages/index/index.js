const app = getApp();
const globalData = (app && app.globalData) || {};
const {
  PLAYER_BLACK,
  PLAYER_WHITE,
  createEmptyBoard,
  cloneBoard,
  togglePlayer,
  hasEmptyCell,
  checkWinner
} = require("../../utils/gomoku");

const BOARD_SIZE = globalData.boardSize || 15;

Page({
  data: {
    board: [],
    currentPlayer: PLAYER_BLACK,
    winner: null,
    statusText: "黑棋先手，请落子",
    history: [],
    lastMove: null,
    canUndo: false
  },

  onLoad() {
    this.resetBoard();
  },

  resetBoard() {
    this.setData({
      board: createEmptyBoard(BOARD_SIZE),
      currentPlayer: PLAYER_BLACK,
      winner: null,
      statusText: "黑棋先手，请落子",
      history: [],
      lastMove: null,
      canUndo: false
    });
  },

  handleCellTap(event) {
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
    let nextPlayer = togglePlayer(player);

    if (winner) {
      statusText = `${player === PLAYER_BLACK ? "黑棋" : "白棋"}胜出！`;
    } else if (!hasEmpty) {
      statusText = "棋盘已满，和局！";
      nextPlayer = this.data.currentPlayer;
    } else {
      statusText = `${nextPlayer === PLAYER_BLACK ? "黑棋" : "白棋"}请落子`;
    }

    this.setData({
      board: currentBoard,
      currentPlayer: winner || !hasEmpty ? this.data.currentPlayer : nextPlayer,
      winner: winner ? player : null,
      statusText,
      history: newHistory,
      lastMove: { row: r, col: c },
      canUndo: newHistory.length > 0
    });
  },

  handleRestart() {
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
    const history = [...this.data.history];
    if (!history.length) {
      return;
    }

    const lastStep = history.pop();
    const board = cloneBoard(this.data.board);
    board[lastStep.row][lastStep.col] = "";

    const preStep = history[history.length - 1] || null;
    const nextPlayer = lastStep.player;
    const statusText = `${nextPlayer === PLAYER_BLACK ? "黑棋" : "白棋"}请继续布局`;

    this.setData({
      board,
      currentPlayer: nextPlayer,
      winner: null,
      statusText,
      history,
      lastMove: preStep ? { row: preStep.row, col: preStep.col } : null,
      canUndo: history.length > 0
    });
  }
});
