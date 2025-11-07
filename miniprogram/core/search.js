const { BOARD_SIZE, PLAYER, SEARCH_DEPTH } = require('./constants');
const {
  applyMove,
  cloneBoard,
  neighbourMoves,
  revertMove,
  checkWin,
  isBoardFull
} = require('./board');
const { evaluateBoard } = require('./evaluation');

function findBestMove(board, depth = SEARCH_DEPTH.NORMAL) {
  const candidates = neighbourMoves(board);
  if (candidates.length === 0) {
    const center = Math.floor(BOARD_SIZE / 2);
    return { row: center, col: center, score: 0 };
  }

  let bestScore = -Infinity;
  let bestMove = candidates[0];

  const workingBoard = cloneBoard(board);

  for (const move of candidates) {
    applyMove(workingBoard, move.row, move.col, PLAYER.AI);
    const score = minimax(workingBoard, depth - 1, false, -Infinity, Infinity, move);
    revertMove(workingBoard, move.row, move.col);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return { ...bestMove, score: bestScore };
}

function minimax(board, depth, maximizing, alpha, beta, lastMove) {
  if (lastMove) {
    const lastPlayer = maximizing ? PLAYER.HUMAN : PLAYER.AI;
    if (checkWin(board, lastMove.row, lastMove.col, lastPlayer)) {
      return lastPlayer === PLAYER.AI ? Infinity : -Infinity;
    }
  }

  if (depth === 0 || isBoardFull(board)) {
    return evaluateBoard(board);
  }

  const moves = neighbourMoves(board);
  if (moves.length === 0) {
    return evaluateBoard(board);
  }

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      applyMove(board, move.row, move.col, PLAYER.AI);
      const evalScore = minimax(board, depth - 1, false, alpha, beta, move);
      revertMove(board, move.row, move.col);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of moves) {
    applyMove(board, move.row, move.col, PLAYER.HUMAN);
    const evalScore = minimax(board, depth - 1, true, alpha, beta, move);
    revertMove(board, move.row, move.col);
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) break;
  }
  return minEval;
}

module.exports = {
  findBestMove
};
