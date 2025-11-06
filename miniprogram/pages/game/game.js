const BOARD_SIZE = 15;
const WIN_COUNT = 5;
const EMPTY = 0;
const AI_PLAYER = 1;
const HUMAN_PLAYER = 2;
const MAX_DEPTH = 2;
const WIN_SCORE = 1000000;

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

const PATTERN_SCORES = {
  openFour: 100000,
  closedFour: 12000,
  openThree: 6000,
  closedThree: 800,
  openTwo: 400,
  closedTwo: 80,
  single: 10
};

Page({
  data: {
    board: createEmptyBoard(),
    isPlayerTurn: true,
    gameOver: false,
    message: '玩家先手，请落子',
    lastMove: null,
    playerFirst: true,
    AI_PLAYER,
    HUMAN_PLAYER
  },

  onLoad() {
    this.resetGame();
  },

  resetGame() {
    const board = createEmptyBoard();
    const playerFirst = this.data.playerFirst;
    const message = playerFirst ? '玩家先手，请落子' : 'AI先手，AI 正在落子...';

    this.setData({
      board,
      isPlayerTurn: playerFirst,
      gameOver: false,
      message,
      lastMove: null
    });

    if (!playerFirst) {
      setTimeout(() => this.aiMove(), 300);
    }
  },

  toggleFirstMove() {
    const nextFirst = !this.data.playerFirst;
    this.setData({
      playerFirst: nextFirst
    }, () => {
      this.resetGame();
    });
  },

  handleCellTap(event) {
    if (!this.data.isPlayerTurn || this.data.gameOver) {
      return;
    }

    const row = Number(event.currentTarget.dataset.row);
    const col = Number(event.currentTarget.dataset.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
      return;
    }

    const board = cloneBoard(this.data.board);
    if (board[row][col] !== EMPTY) {
      return;
    }

    board[row][col] = HUMAN_PLAYER;

    if (checkWin(board, row, col, HUMAN_PLAYER)) {
      this.setData({
        board,
        gameOver: true,
        lastMove: { row, col },
        message: '恭喜，你赢了！'
      });
      return;
    }

    if (isBoardFull(board)) {
      this.setData({
        board,
        gameOver: true,
        lastMove: { row, col },
        message: '平局，双方旗鼓相当！'
      });
      return;
    }

    this.setData({
      board,
      isPlayerTurn: false,
      lastMove: { row, col },
      message: 'AI 思考中...'
    });

    setTimeout(() => this.aiMove(), 120);
  },

  aiMove() {
    if (this.data.gameOver) {
      return;
    }

    const board = cloneBoard(this.data.board);
    const best = findBestMove(board, MAX_DEPTH);
    let move = best && best.move;

    if (!move) {
      move = fallbackMove(board);
    }

    if (!move) {
      this.setData({
        message: 'AI 无子可落，平局结束',
        gameOver: true
      });
      return;
    }

    board[move.row][move.col] = AI_PLAYER;

    if (checkWin(board, move.row, move.col, AI_PLAYER)) {
      this.setData({
        board,
        lastMove: move,
        gameOver: true,
        message: 'AI 获胜，下次再接再厉！'
      });
      return;
    }

    if (isBoardFull(board)) {
      this.setData({
        board,
        lastMove: move,
        gameOver: true,
        message: '棋盘已满，平局结束'
      });
      return;
    }

    this.setData({
      board,
      lastMove: move,
      isPlayerTurn: true,
      message: '轮到你落子'
    });
  }
});

function createEmptyBoard() {
  const board = new Array(BOARD_SIZE);
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    board[i] = new Array(BOARD_SIZE).fill(EMPTY);
  }
  return board;
}

function cloneBoard(board) {
  return board.map(row => row.slice());
}

function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function checkWin(board, row, col, player) {
  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;

    let r = row + dr;
    let c = col + dc;
    while (isInside(r, c) && board[r][c] === player) {
      count += 1;
      r += dr;
      c += dc;
    }

    r = row - dr;
    c = col - dc;
    while (isInside(r, c) && board[r][c] === player) {
      count += 1;
      r -= dr;
      c -= dc;
    }

    if (count >= WIN_COUNT) {
      return true;
    }
  }
  return false;
}

function isBoardFull(board) {
  for (let i = 0; i < BOARD_SIZE; i += 1) {
    for (let j = 0; j < BOARD_SIZE; j += 1) {
      if (board[i][j] === EMPTY) {
        return false;
      }
    }
  }
  return true;
}

function evaluateBoard(board) {
  const aiScore = evaluatePlayer(board, AI_PLAYER);
  if (aiScore >= WIN_SCORE) {
    return WIN_SCORE;
  }

  const humanScore = evaluatePlayer(board, HUMAN_PLAYER);
  if (humanScore >= WIN_SCORE) {
    return -WIN_SCORE;
  }

  return aiScore - humanScore;
}

function evaluatePlayer(board, player) {
  let score = 0;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] !== player) {
        continue;
      }

      for (const [dr, dc] of DIRECTIONS) {
        const prevRow = row - dr;
        const prevCol = col - dc;

        if (isInside(prevRow, prevCol) && board[prevRow][prevCol] === player) {
          continue;
        }

        let count = 0;
        let r = row;
        let c = col;
        while (isInside(r, c) && board[r][c] === player) {
          count += 1;
          r += dr;
          c += dc;
        }

        const forwardOpen = isInside(r, c) && board[r][c] === EMPTY;
        const backwardRow = row - dr;
        const backwardCol = col - dc;
        const backwardOpen = isInside(backwardRow, backwardCol) && board[backwardRow][backwardCol] === EMPTY;

        if (count >= WIN_COUNT) {
          return WIN_SCORE;
        }

        const openEnds = (forwardOpen ? 1 : 0) + (backwardOpen ? 1 : 0);

        switch (count) {
          case 4:
            if (openEnds === 2) {
              score += PATTERN_SCORES.openFour;
            } else if (openEnds === 1) {
              score += PATTERN_SCORES.closedFour;
            }
            break;
          case 3:
            if (openEnds === 2) {
              score += PATTERN_SCORES.openThree;
            } else if (openEnds === 1) {
              score += PATTERN_SCORES.closedThree;
            }
            break;
          case 2:
            if (openEnds === 2) {
              score += PATTERN_SCORES.openTwo;
            } else if (openEnds === 1) {
              score += PATTERN_SCORES.closedTwo;
            }
            break;
          case 1:
            if (openEnds >= 1) {
              score += PATTERN_SCORES.single;
            }
            break;
          default:
            break;
        }
      }
    }
  }

  return score;
}

function fallbackMove(board) {
  const candidates = generateCandidates(board);
  if (candidates.length === 0) {
    return null;
  }
  return candidates[0];
}

function findBestMove(board, depth) {
  const candidates = orderCandidates(board, generateCandidates(board), AI_PLAYER);
  let bestScore = -Infinity;
  let bestMove = null;

  for (const move of candidates) {
    board[move.row][move.col] = AI_PLAYER;
    const score = minimax(board, depth - 1, -Infinity, Infinity, false, { row: move.row, col: move.col, player: AI_PLAYER });
    board[move.row][move.col] = EMPTY;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return { score: bestScore, move: bestMove };
}

function minimax(board, depth, alpha, beta, maximizingPlayer, lastMove) {
  if (lastMove) {
    if (checkWin(board, lastMove.row, lastMove.col, lastMove.player)) {
      const delta = depth + 1;
      if (lastMove.player === AI_PLAYER) {
        return WIN_SCORE - 10 * delta;
      }
      return -WIN_SCORE + 10 * delta;
    }
  }

  if (depth === 0 || isBoardFull(board)) {
    return evaluateBoard(board);
  }

  const player = maximizingPlayer ? AI_PLAYER : HUMAN_PLAYER;
  const candidates = orderCandidates(board, generateCandidates(board), player);

  if (candidates.length === 0) {
    return evaluateBoard(board);
  }

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of candidates) {
      board[move.row][move.col] = AI_PLAYER;
      const evalScore = minimax(board, depth - 1, alpha, beta, false, { row: move.row, col: move.col, player: AI_PLAYER });
      board[move.row][move.col] = EMPTY;
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) {
        break;
      }
    }
    return maxEval;
  }

  let minEval = Infinity;
  for (const move of candidates) {
    board[move.row][move.col] = HUMAN_PLAYER;
    const evalScore = minimax(board, depth - 1, alpha, beta, true, { row: move.row, col: move.col, player: HUMAN_PLAYER });
    board[move.row][move.col] = EMPTY;
    minEval = Math.min(minEval, evalScore);
    beta = Math.min(beta, evalScore);
    if (beta <= alpha) {
      break;
    }
  }
  return minEval;
}

function generateCandidates(board) {
  const points = new Set();
  let hasStone = false;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] !== EMPTY) {
        hasStone = true;
        for (let dr = -2; dr <= 2; dr += 1) {
          for (let dc = -2; dc <= 2; dc += 1) {
            const nr = row + dr;
            const nc = col + dc;
            if (!isInside(nr, nc) || board[nr][nc] !== EMPTY) {
              continue;
            }
            points.add(`${nr},${nc}`);
          }
        }
      }
    }
  }

  if (!hasStone) {
    const center = Math.floor(BOARD_SIZE / 2);
    return [{ row: center, col: center }];
  }

  return Array.from(points).map(item => {
    const [row, col] = item.split(',').map(Number);
    return { row, col };
  });
}

function orderCandidates(board, candidates, player) {
  const scored = candidates.map(move => {
    board[move.row][move.col] = player;
    const score = evaluateBoard(board);
    board[move.row][move.col] = EMPTY;
    return { move, score };
  });

  scored.sort((a, b) => {
    if (player === AI_PLAYER) {
      return b.score - a.score;
    }
    return a.score - b.score;
  });

  return scored
    .slice(0, 12)
    .map(item => item.move);
}