const DEFAULT_OPTIONS = {
  boardSize: 15,
  maxDepth: 3,
  maxCandidates: 12,
  timeLimit: 1600
};

const HUMAN = 1;
const AI = 2;
const WIN_SCORE = 10_000_000;

function createBeanSproutAI(options = {}) {
  const {
    boardSize,
    maxDepth,
    maxCandidates,
    timeLimit
  } = { ...DEFAULT_OPTIONS, ...options };

  const zobrist = createZobrist(boardSize);
  const transposition = new Map();
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  function reset() {
    transposition.clear();
  }

  function cloneBoard(board) {
    return board.map(row => row.slice());
  }

  function computeBestMove(board, player, lastMove) {
    const emptyCount = countEmpty(board);
    if (emptyCount === 0) {
      return null;
    }

    const maxSearchDepth = decideDepth(emptyCount);
    let bestMove = null;
    let bestScore = -Infinity;
    const startTime = Date.now();
    const candidateMoves = generateCandidates(board, lastMove, player);
    candidateMoves.sort((a, b) => b.score - a.score);
    const limitedCandidates = candidateMoves.slice(0, maxCandidates);

    for (let depth = 1; depth <= maxSearchDepth; depth++) {
      for (const move of limitedCandidates) {
        if (Date.now() - startTime > timeLimit) {
          return bestMove;
        }
        const { row, col } = move;
        board[row][col] = player;
        const score = minimax(
          board,
          depth - 1,
          -Infinity,
          Infinity,
          switchPlayer(player),
          player,
          { row, col, player },
          startTime,
          timeLimit
        );
        board[row][col] = 0;

        if (score > bestScore || !bestMove) {
          bestScore = score;
          bestMove = { row, col };
        }
        if (Math.abs(score) >= WIN_SCORE - 1000) {
          return { row, col };
        }
      }
    }

    return bestMove || limitedCandidates[0] || null;
  }

  function minimax(
    board,
    depth,
    alpha,
    beta,
    currentPlayer,
    maximizingPlayer,
    lastMove,
    startTime,
    timeLimit
  ) {
    const hashKey = hashBoard(board);
    const hashed = transposition.get(hashKey);
    if (hashed && hashed.depth >= depth) {
      return hashed.value;
    }

    const lastPlayer = switchPlayer(currentPlayer);
    if (
      lastMove &&
      checkVictory(board, lastMove.row, lastMove.col, lastPlayer)
    ) {
      const winValue =
        lastPlayer === maximizingPlayer
          ? WIN_SCORE - (maxDepth - depth)
          : -WIN_SCORE + (maxDepth - depth);
      return winValue;
    }

    if (depth === 0 || isBoardFull(board)) {
      const evaluation = evaluateBoard(board, maximizingPlayer);
      transposition.set(hashKey, { depth, value: evaluation });
      return evaluation;
    }

    if (Date.now() - startTime > timeLimit) {
      const evaluation = evaluateBoard(board, maximizingPlayer);
      return evaluation;
    }

    const candidates = generateCandidates(board, lastMove, currentPlayer);
    if (!candidates.length) {
      const evaluation = evaluateBoard(board, maximizingPlayer);
      transposition.set(hashKey, { depth, value: evaluation });
      return evaluation;
    }

    candidates.sort((a, b) => b.score - a.score);
    let value;

    if (currentPlayer === maximizingPlayer) {
      value = -Infinity;
      for (const move of candidates.slice(0, maxCandidates)) {
        const { row, col } = move;
        board[row][col] = currentPlayer;
        const childValue = minimax(
          board,
          depth - 1,
          alpha,
          beta,
          switchPlayer(currentPlayer),
          maximizingPlayer,
          { row, col, player: currentPlayer },
          startTime,
          timeLimit
        );
        board[row][col] = 0;

        value = Math.max(value, childValue);
        alpha = Math.max(alpha, value);
        if (alpha >= beta) {
          break;
        }
      }
    } else {
      value = Infinity;
      for (const move of candidates.slice(0, maxCandidates)) {
        const { row, col } = move;
        board[row][col] = currentPlayer;
        const childValue = minimax(
          board,
          depth - 1,
          alpha,
          beta,
          switchPlayer(currentPlayer),
          maximizingPlayer,
          { row, col, player: currentPlayer },
          startTime,
          timeLimit
        );
        board[row][col] = 0;

        value = Math.min(value, childValue);
        beta = Math.min(beta, value);
        if (alpha >= beta) {
          break;
        }
      }
    }

    transposition.set(hashKey, { depth, value });
    return value;
  }

  function checkVictory(board, row, col, player) {
    for (const [dx, dy] of directions) {
      let count = 1;
      count += countDirection(board, row, col, dx, dy, player);
      count += countDirection(board, row, col, -dx, -dy, player);
      if (count >= 5) {
        return true;
      }
    }
    return false;
  }

  function countDirection(board, row, col, dx, dy, player) {
    let count = 0;
    let r = row + dx;
    let c = col + dy;
    while (
      r >= 0 &&
      r < boardSize &&
      c >= 0 &&
      c < boardSize &&
      board[r][c] === player
    ) {
      count += 1;
      r += dx;
      c += dy;
    }
    return count;
  }

  function evaluateBoard(board, player) {
    const opponent = switchPlayer(player);
    const playerScore = evaluatePlayer(board, player);
    const opponentScore = evaluatePlayer(board, opponent);
    return playerScore - opponentScore;
  }

  function evaluatePlayer(board, player) {
    let score = 0;
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] !== player) continue;
        for (const [dx, dy] of directions) {
          const prevRow = row - dx;
          const prevCol = col - dy;
          if (
            prevRow >= 0 &&
            prevRow < boardSize &&
            prevCol >= 0 &&
            prevCol < boardSize &&
            board[prevRow][prevCol] === player
          ) {
            continue;
          }
          let count = 1;
          let openEnds = 0;
          let r = row + dx;
          let c = col + dy;
          while (
            r >= 0 &&
            r < boardSize &&
            c >= 0 &&
            c < boardSize &&
            board[r][c] === player
          ) {
            count += 1;
            r += dx;
            c += dy;
          }
          if (
            r >= 0 &&
            r < boardSize &&
            c >= 0 &&
            c < boardSize &&
            board[r][c] === 0
          ) {
            openEnds += 1;
          }

          r = row - dx;
          c = col - dy;
          while (
            r >= 0 &&
            r < boardSize &&
            c >= 0 &&
            c < boardSize &&
            board[r][c] === player
          ) {
            count += 1;
            r -= dx;
            c -= dy;
          }
          if (
            r >= 0 &&
            r < boardSize &&
            c >= 0 &&
            c < boardSize &&
            board[r][c] === 0
          ) {
            openEnds += 1;
          }

          score += patternScore(count, openEnds);
          if (count >= 5) {
            return WIN_SCORE;
          }
        }
      }
    }
    return score;
  }

  function patternScore(count, openEnds) {
    if (count >= 5) {
      return WIN_SCORE;
    }
    if (openEnds === 0) {
      return 0;
    }
    const table = {
      4: { 2: 500000, 1: 10000 },
      3: { 2: 8000, 1: 2000 },
      2: { 2: 500, 1: 120 },
      1: { 2: 50, 1: 10 }
    };
    return table[count]?.[openEnds] || 0;
  }

  function generateCandidates(board, lastMove, currentPlayer) {
    const candidates = new Map();

    if (!hasStone(board)) {
      const center = Math.floor(boardSize / 2);
      candidates.set(`${center},${center}`, {
        row: center,
        col: center,
        score: 9000
      });
      return Array.from(candidates.values());
    }

    const radius = 2;
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] === 0 && hasNeighbor(board, row, col, radius)) {
          const scoreForCurrent = evaluatePoint(board, row, col, currentPlayer);
          const scoreForOpponent = evaluatePoint(
            board,
            row,
            col,
            switchPlayer(currentPlayer)
          );
          const key = `${row},${col}`;
          candidates.set(key, {
            row,
            col,
            score: scoreForCurrent + scoreForOpponent * 0.9
          });
        }
      }
    }

    return Array.from(candidates.values());
  }

  function evaluatePoint(board, row, col, player) {
    let score = 0;
    for (const [dx, dy] of directions) {
      const result = countWithOpenEnds(board, row, col, dx, dy, player);
      score += patternScore(result.count, result.openEnds);
    }
    return score;
  }

  function countWithOpenEnds(board, row, col, dx, dy, player) {
    let count = 1;
    let openEnds = 0;
    let r = row + dx;
    let c = col + dy;
    while (
      r >= 0 &&
      r < boardSize &&
      c >= 0 &&
      c < boardSize &&
      board[r][c] === player
    ) {
      count += 1;
      r += dx;
      c += dy;
    }
    if (
      r >= 0 &&
      r < boardSize &&
      c >= 0 &&
      c < boardSize &&
      board[r][c] === 0
    ) {
      openEnds += 1;
    }

    r = row - dx;
    c = col - dy;
    while (
      r >= 0 &&
      r < boardSize &&
      c >= 0 &&
      c < boardSize &&
      board[r][c] === player
    ) {
      count += 1;
      r -= dx;
      c -= dy;
    }
    if (
      r >= 0 &&
      r < boardSize &&
      c >= 0 &&
      c < boardSize &&
      board[r][c] === 0
    ) {
      openEnds += 1;
    }

    return { count, openEnds };
  }

  function hasNeighbor(board, row, col, radius) {
    for (let r = row - radius; r <= row + radius; r++) {
      for (let c = col - radius; c <= col + radius; c++) {
        if (
          r >= 0 &&
          r < boardSize &&
          c >= 0 &&
          c < boardSize &&
          !(r === row && c === col) &&
          board[r][c] !== 0
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function hasStone(board) {
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  function countEmpty(board) {
    let empty = 0;
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col] === 0) empty += 1;
      }
    }
    return empty;
  }

  function isBoardFull(board) {
    return countEmpty(board) === 0;
  }

  function switchPlayer(player) {
    return player === HUMAN ? AI : HUMAN;
  }

  function decideDepth(emptyCount) {
    if (emptyCount > 150) return Math.min(2, maxDepth);
    if (emptyCount > 60) return Math.min(3, maxDepth);
    if (emptyCount > 30) return Math.min(4, maxDepth);
    return maxDepth;
  }

  function createZobrist(size) {
    const table = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => [
        randomBigInt(),
        randomBigInt(),
        randomBigInt()
      ])
    );
    return table;
  }

  function hashBoard(board) {
    let hash = 0n;
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const value = board[row][col];
        if (value === 0) continue;
        hash ^= zobrist[row][col][value];
      }
    }
    return hash.toString();
  }

  function randomBigInt() {
    const high = Math.floor(Math.random() * 0xffffffff);
    const low = Math.floor(Math.random() * 0xffffffff);
    return BigInt(high) << 32n | BigInt(low);
  }

  return {
    computeBestMove,
    reset,
    cloneBoard
  };
}

module.exports = {
  createBeanSproutAI
};
