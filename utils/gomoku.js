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

function simulateMove(board, row, col, player) {
  const nextBoard = cloneBoard(board);
  nextBoard[row][col] = player;
  return nextBoard;
}

function getAvailableMoves(board) {
  const moves = [];
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (!board[row][col]) {
        moves.push({ row, col });
      }
    }
  }
  return moves;
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

function getMaxConnectedCount(board, row, col, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  let maxCount = 1;
  for (let i = 0; i < directions.length; i += 1) {
    const [dx, dy] = directions[i];
    const count =
      1 +
      countDirection(board, row, col, dx, dy, player) +
      countDirection(board, row, col, -dx, -dy, player);
    if (count > maxCount) {
      maxCount = count;
    }
  }
  return maxCount;
}

function evaluateMove(board, row, col, aiPlayer, opponentPlayer) {
  const size = board.length;
  const center = (size - 1) / 2;
  const centerScore =
    size - (Math.abs(row - center) + Math.abs(col - center));

  const offensiveBoard = simulateMove(board, row, col, aiPlayer);
  const defensiveBoard = simulateMove(board, row, col, opponentPlayer);

  const offensiveStrength = getMaxConnectedCount(
    offensiveBoard,
    row,
    col,
    aiPlayer
  );
  const defensiveStrength = getMaxConnectedCount(
    defensiveBoard,
    row,
    col,
    opponentPlayer
  );

  return centerScore + offensiveStrength ** 3 + defensiveStrength ** 2;
}

function findBestMove(board, aiPlayer = PLAYER_WHITE, opponentPlayer = PLAYER_BLACK) {
  const moves = getAvailableMoves(board);
  if (!moves.length) {
    return null;
  }

  // 1. 立即获胜优先
  for (let i = 0; i < moves.length; i += 1) {
    const { row, col } = moves[i];
    const simulated = simulateMove(board, row, col, aiPlayer);
    if (checkWinner(simulated, row, col, aiPlayer)) {
      return { row, col };
    }
  }

  // 2. 阻止对方获胜
  for (let i = 0; i < moves.length; i += 1) {
    const { row, col } = moves[i];
    const simulated = simulateMove(board, row, col, opponentPlayer);
    if (checkWinner(simulated, row, col, opponentPlayer)) {
      return { row, col };
    }
  }

  // 3. 综合得分
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (let i = 0; i < moves.length; i += 1) {
    const { row, col } = moves[i];
    const score = evaluateMove(board, row, col, aiPlayer, opponentPlayer);
    if (score > bestScore) {
      bestScore = score;
      bestMove = { row, col };
    }
  }

  return bestMove;
}

module.exports = {
  PLAYER_BLACK,
  PLAYER_WHITE,
  createEmptyBoard,
  cloneBoard,
  togglePlayer,
  hasEmptyCell,
  checkWinner,
  findBestMove,
  simulateMove
};
