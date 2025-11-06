const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

const DEFAULT_OPTIONS = {
  boardSize: 15,
  maxDepth: 2,
  maxCandidates: 16
};

export default class GomokuAI {
  constructor(options = {}) {
    const merged = { ...DEFAULT_OPTIONS, ...options };
    this.boardSize = merged.boardSize;
    this.maxDepth = merged.maxDepth;
    this.maxCandidates = merged.maxCandidates;
    this.winScore = 1_000_000;
  }

  bestMove(board, aiPlayer = -1) {
    this.aiPlayer = aiPlayer;

    const moves = this.generateMoves(board, aiPlayer);
    if (!moves.length) {
      return null;
    }

    let alpha = -Infinity;
    const beta = Infinity;
    let best = null;

    for (const move of moves) {
      board[move.y][move.x] = aiPlayer;
      const score = -this.negamax(board, this.maxDepth - 1, -beta, -alpha, -aiPlayer, move);
      board[move.y][move.x] = 0;

      if (!best || score > best.score) {
        best = { ...move, score };
      }

      if (score > alpha) {
        alpha = score;
      }
    }

    return best;
  }

  negamax(board, depth, alpha, beta, player, lastMove) {
    if (lastMove && this.isWin(board, lastMove.x, lastMove.y, -player)) {
      return -this.winScore + depth;
    }

    if (depth === 0) {
      return this.evaluate(board, player);
    }

    const moves = this.generateMoves(board, player);
    if (!moves.length) {
      return 0;
    }

    let value = -Infinity;
    for (const move of moves) {
      board[move.y][move.x] = player;
      const score = -this.negamax(board, depth - 1, -beta, -alpha, -player, move);
      board[move.y][move.x] = 0;

      if (score > value) {
        value = score;
      }

      if (value > alpha) {
        alpha = value;
      }

      if (alpha >= beta) {
        break;
      }
    }

    return value;
  }

  evaluate(board, player) {
    return this.scoreBoard(board, player) - this.scoreBoard(board, -player);
  }

  scoreBoard(board, player) {
    let total = 0;

    for (let y = 0; y < this.boardSize; y += 1) {
      for (let x = 0; x < this.boardSize; x += 1) {
        if (board[y][x] !== player) continue;

        for (const [dx, dy] of DIRECTIONS) {
          const prevX = x - dx;
          const prevY = y - dy;
          if (this.isInside(prevX, prevY) && board[prevY][prevX] === player) {
            continue;
          }

          const { count, openEnds } = this.countSequence(board, x, y, dx, dy, player);
          if (count > 0) {
            total += this.scoreForCount(count, openEnds);
          }
        }
      }
    }

    return total;
  }

  countSequence(board, startX, startY, dx, dy, player) {
    let count = 0;
    let x = startX;
    let y = startY;

    while (this.isInside(x, y) && board[y][x] === player) {
      count += 1;
      x += dx;
      y += dy;
    }

    let openEnds = 0;
    if (this.isInside(x, y) && board[y][x] === 0) {
      openEnds += 1;
    }

    const backX = startX - dx;
    const backY = startY - dy;
    if (this.isInside(backX, backY) && board[backY][backX] === 0) {
      openEnds += 1;
    }

    return { count, openEnds };
  }

  generateMoves(board, player) {
    const moves = [];
    let hasStone = false;
    let minX = this.boardSize - 1;
    let maxX = 0;
    let minY = this.boardSize - 1;
    let maxY = 0;

    for (let y = 0; y < this.boardSize; y += 1) {
      for (let x = 0; x < this.boardSize; x += 1) {
        if (board[y][x] !== 0) {
          hasStone = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!hasStone) {
      const center = Math.floor(this.boardSize / 2);
      return [{ x: center, y: center, score: 0 }];
    }

    minX = Math.max(minX - 2, 0);
    maxX = Math.min(maxX + 2, this.boardSize - 1);
    minY = Math.max(minY - 2, 0);
    maxY = Math.min(maxY + 2, this.boardSize - 1);

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (board[y][x] !== 0) {
          continue;
        }

        if (!this.hasNeighbor(board, x, y, 2)) {
          continue;
        }

        board[y][x] = player;
        if (this.isWin(board, x, y, player)) {
          board[y][x] = 0;
          return [{ x, y, score: this.winScore }];
        }
        const attack = this.evaluatePoint(board, x, y, player);
        board[y][x] = 0;

        board[y][x] = -player;
        const defense = this.evaluatePoint(board, x, y, -player);
        board[y][x] = 0;

        moves.push({
          x,
          y,
          score: attack + defense * 0.9
        });
      }
    }

    moves.sort((a, b) => b.score - a.score);

    if (moves.length > this.maxCandidates) {
      return moves.slice(0, this.maxCandidates);
    }

    return moves;
  }

  hasNeighbor(board, x, y, distance) {
    for (let dy = -distance; dy <= distance; dy += 1) {
      for (let dx = -distance; dx <= distance; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!this.isInside(nx, ny)) continue;
        if (board[ny][nx] !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  evaluatePoint(board, x, y, player) {
    let total = 0;

    for (const [dx, dy] of DIRECTIONS) {
      let count = 1;
      let openEnds = 0;

      let nx = x + dx;
      let ny = y + dy;
      while (this.isInside(nx, ny) && board[ny][nx] === player) {
        count += 1;
        nx += dx;
        ny += dy;
      }
      if (this.isInside(nx, ny) && board[ny][nx] === 0) {
        openEnds += 1;
      }

      nx = x - dx;
      ny = y - dy;
      while (this.isInside(nx, ny) && board[ny][nx] === player) {
        count += 1;
        nx -= dx;
        ny -= dy;
      }
      if (this.isInside(nx, ny) && board[ny][nx] === 0) {
        openEnds += 1;
      }

      total += this.scoreForCount(count, openEnds);
    }

    return total;
  }

  isWin(board, x, y, player) {
    for (const [dx, dy] of DIRECTIONS) {
      const forward = this.countInDirection(board, x, y, dx, dy, player);
      const backward = this.countInDirection(board, x, y, -dx, -dy, player);
      if (forward + backward + 1 >= 5) {
        return true;
      }
    }
    return false;
  }

  countInDirection(board, x, y, dx, dy, player) {
    let count = 0;
    let nx = x + dx;
    let ny = y + dy;

    while (this.isInside(nx, ny) && board[ny][nx] === player) {
      count += 1;
      nx += dx;
      ny += dy;
    }

    return count;
  }

  scoreForCount(count, openEnds) {
    if (count >= 5) return this.winScore;
    if (count === 4) {
      if (openEnds === 2) return 100_000;
      if (openEnds === 1) return 10_000;
    }
    if (count === 3) {
      if (openEnds === 2) return 5_000;
      if (openEnds === 1) return 500;
    }
    if (count === 2) {
      if (openEnds === 2) return 200;
      if (openEnds === 1) return 50;
    }
    if (count === 1) {
      if (openEnds === 2) return 10;
      if (openEnds === 1) return 2;
    }
    return 0;
  }

  isInside(x, y) {
    return x >= 0 && x < this.boardSize && y >= 0 && y < this.boardSize;
  }
}
