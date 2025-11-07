const BOARD_SIZE = 15;
const PLAYER_NAME_MAP = {
  black: '黑棋',
  white: '白棋'
};

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(''));
}

Page({
  data: {
    board: [],
    currentPlayer: 'black',
    message: '',
    status: 'playing',
    moveCount: 0,
    winner: '',
    lastMoveKey: '',
    winnerMap: {}
  },

  onLoad() {
    this.resetGame();
  },

  resetGame() {
    this.setData({
      board: createEmptyBoard(),
      currentPlayer: 'black',
      message: '黑棋先手，请落子',
      status: 'playing',
      moveCount: 0,
      winner: '',
      lastMoveKey: '',
      winnerMap: {}
    });
  },

  handleReset() {
    this.resetGame();
  },

  handleCellTap(event) {
    const { status, currentPlayer } = this.data;
    if (status !== 'playing') {
      return;
    }

    const row = Number(event.currentTarget.dataset.row);
    const col = Number(event.currentTarget.dataset.col);

    if (Number.isNaN(row) || Number.isNaN(col)) {
      return;
    }

    const board = this.data.board.map((rowArr) => rowArr.slice());
    if (board[row][col]) {
      return;
    }

    board[row][col] = currentPlayer;
    const moveCount = this.data.moveCount + 1;
    const lastMoveKey = `${row}-${col}`;
    const winnerMap = {};

    if (this.checkWin(board, row, col, currentPlayer, winnerMap)) {
      this.setData({
        board,
        moveCount,
        status: 'ended',
        winner: currentPlayer,
        message: `${PLAYER_NAME_MAP[currentPlayer]}获胜！`,
        lastMoveKey,
        winnerMap
      });
      return;
    }

    if (moveCount >= BOARD_SIZE * BOARD_SIZE) {
      this.setData({
        board,
        moveCount,
        status: 'ended',
        winner: 'draw',
        message: '平局，棋盘已满',
        lastMoveKey,
        winnerMap: {}
      });
      return;
    }

    const nextPlayer = currentPlayer === 'black' ? 'white' : 'black';

    this.setData({
      board,
      moveCount,
      currentPlayer: nextPlayer,
      message: `${PLAYER_NAME_MAP[nextPlayer]}落子`,
      lastMoveKey,
      winnerMap: {}
    });
  },

  checkWin(board, row, col, player, winnerMap) {
    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1]
    ];

    for (let i = 0; i < directions.length; i += 1) {
      const [dRow, dCol] = directions[i];
      const result = this.calcLine(board, row, col, dRow, dCol, player);
      if (result.count >= 5) {
        result.positions.forEach(([r, c]) => {
          winnerMap[`${r}-${c}`] = true;
        });
        return true;
      }
    }

    return false;
  },

  calcLine(board, row, col, deltaRow, deltaCol, player) {
    const positions = [[row, col]];
    let count = 1;

    let r = row + deltaRow;
    let c = col + deltaCol;
    while (this.inBounds(r, c) && board[r][c] === player) {
      positions.push([r, c]);
      count += 1;
      r += deltaRow;
      c += deltaCol;
    }

    r = row - deltaRow;
    c = col - deltaCol;
    while (this.inBounds(r, c) && board[r][c] === player) {
      positions.unshift([r, c]);
      count += 1;
      r -= deltaRow;
      c -= deltaCol;
    }

    return { count, positions };
  },

  inBounds(row, col) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }
});
