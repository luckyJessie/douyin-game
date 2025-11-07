const PLAYER_BLACK = "black";
const PLAYER_WHITE = "white";

function createEmptyBoard(size) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => "")
  );
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

function togglePlayer(player) {
  return player === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
}

function hasEmptyCell(board) {
  return board.some((row) => row.some((cell) => !cell));
}

function checkWinner(board, row, col, player, winLength = 5) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (let i = 0; i < directions.length; i += 1) {
    const [dx, dy] = directions[i];
    const count =
      1 +
      countDirection(board, row, col, dx, dy, player) +
      countDirection(board, row, col, -dx, -dy, player);
    if (count >= winLength) {
      return player;
    }
  }
  return null;
}

function countDirection(board, row, col, dx, dy, player) {
  const size = board.length;
  let r = row + dx;
  let c = col + dy;
  let count = 0;

  while (r >= 0 && r < size && c >= 0 && c < size) {
    if (board[r][c] === player) {
      count += 1;
      r += dx;
      c += dy;
    } else {
      break;
    }
  }
  return count;
}

module.exports = {
  PLAYER_BLACK,
  PLAYER_WHITE,
  createEmptyBoard,
  cloneBoard,
  togglePlayer,
  hasEmptyCell,
  checkWinner
};
