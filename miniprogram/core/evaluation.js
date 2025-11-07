const { BOARD_SIZE, CELL, PLAYER, WIN_COUNT } = require('./constants');
const { isInside } = require('./board');

const PATTERN_SCORE = {
  FIVE: 1_000_000,
  OPEN_FOUR: 100_000,
  CLOSED_FOUR: 15_000,
  OPEN_THREE: 8_000,
  CLOSED_THREE: 1_000,
  OPEN_TWO: 400,
  CLOSED_TWO: 50,
  SINGLE: 10
};

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

function evaluateBoard(board) {
  return evaluatePlayer(board, PLAYER.AI) - evaluatePlayer(board, PLAYER.HUMAN);
}

function evaluatePlayer(board, player) {
  const opponent = player === PLAYER.AI ? PLAYER.HUMAN : PLAYER.AI;
  let score = 0;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] !== player) continue;
      for (const [dr, dc] of DIRECTIONS) {
        score += evaluateDirection(board, row, col, dr, dc, player, opponent);
      }
    }
  }
  return score;
}

function evaluateDirection(board, row, col, dr, dc, player, opponent) {
  const prevRow = row - dr;
  const prevCol = col - dc;
  if (isInside(prevRow, prevCol) && board[prevRow][prevCol] === player) {
    return 0;
  }

  let r = row;
  let c = col;
  let count = 0;

  while (isInside(r, c) && board[r][c] === player) {
    count += 1;
    r += dr;
    c += dc;
  }

    const forwardEmpty = isInside(r, c) && board[r][c] === CELL.EMPTY;
    const backwardEmpty = isInside(prevRow, prevCol) && board[prevRow][prevCol] === CELL.EMPTY;

  if (count >= WIN_COUNT) {
    return PATTERN_SCORE.FIVE;
  }

  const openEnds = (forwardEmpty ? 1 : 0) + (backwardEmpty ? 1 : 0);

  switch (count) {
    case 4:
      if (openEnds === 2) return PATTERN_SCORE.OPEN_FOUR;
      if (openEnds === 1) return PATTERN_SCORE.CLOSED_FOUR;
      break;
    case 3:
      if (openEnds === 2) return PATTERN_SCORE.OPEN_THREE;
      if (openEnds === 1) return PATTERN_SCORE.CLOSED_THREE;
      break;
    case 2:
      if (openEnds === 2) return PATTERN_SCORE.OPEN_TWO;
      if (openEnds === 1) return PATTERN_SCORE.CLOSED_TWO;
      break;
    default:
      if (openEnds > 0) return PATTERN_SCORE.SINGLE;
  }

  return 0;
}

module.exports = {
  evaluateBoard
};
