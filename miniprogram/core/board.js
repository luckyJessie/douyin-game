const { BOARD_SIZE, CELL, WIN_COUNT, PLAYER } = require('./constants');

function createBoard(size = BOARD_SIZE) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => CELL.EMPTY)
  );
}

function cloneBoard(board) {
  return board.map(row => row.slice());
}

function serializeBoard(board) {
  return board.map(row => row.join(',')).join('|');
}

function isInside(row, col, size = BOARD_SIZE) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

function isEmpty(board, row, col) {
  return board[row][col] === CELL.EMPTY;
}

function applyMove(board, row, col, player) {
  if (!isInside(row, col) || !isEmpty(board, row, col)) {
    return false;
  }
  board[row][col] = player;
  return true;
}

function revertMove(board, row, col) {
  board[row][col] = CELL.EMPTY;
}

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

function checkWin(board, row, col, player) {
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    count += countDirection(board, row, col, dr, dc, player);
    count += countDirection(board, row, col, -dr, -dc, player);
    if (count >= WIN_COUNT) {
      return true;
    }
  }
  return false;
}

function countDirection(board, row, col, dr, dc, player) {
  let r = row + dr;
  let c = col + dc;
  let count = 0;
  while (isInside(r, c) && board[r][c] === player) {
    count += 1;
    r += dr;
    c += dc;
  }
  return count;
}

function isBoardFull(board) {
  return board.every(row => row.every(cell => cell !== CELL.EMPTY));
}

function neighbourMoves(board, distance = 2) {
  const seen = new Set();
  for (let r = 0; r < board.length; r += 1) {
    for (let c = 0; c < board[r].length; c += 1) {
      if (board[r][c] === CELL.EMPTY) continue;
      for (let dr = -distance; dr <= distance; dr += 1) {
        for (let dc = -distance; dc <= distance; dc += 1) {
          const nr = r + dr;
          const nc = c + dc;
          if (!isInside(nr, nc) || board[nr][nc] !== CELL.EMPTY) continue;
          seen.add(`${nr},${nc}`);
        }
      }
    }
  }
  if (seen.size === 0) {
    const center = Math.floor(board.length / 2);
    return [{ row: center, col: center }];
  }
  return Array.from(seen).map(key => {
    const [row, col] = key.split(',').map(Number);
    return { row, col };
  });
}

function playerName(player) {
  switch (player) {
    case PLAYER.HUMAN:
      return '黑方';
    case PLAYER.AI:
      return '白方';
    default:
      return '未知';
  }
}

module.exports = {
  createBoard,
  cloneBoard,
  serializeBoard,
  isInside,
  isEmpty,
  applyMove,
  revertMove,
  checkWin,
  isBoardFull,
  neighbourMoves,
  playerName
};
