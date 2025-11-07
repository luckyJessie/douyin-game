const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

const SCORES = {
  FIVE: 1_000_000_000,
  OPEN_FOUR: 10_000_000,
  BLOCKED_FOUR: 1_000_000,
  OPEN_THREE: 200_000,
  BLOCKED_THREE: 20_000,
  OPEN_TWO: 4_000,
  BLOCKED_TWO: 400,
  SINGLE: 40
};

const DEFAULT_OPTIONS = {
  depth: 3,
  timeLimit: 1500,
  moveRadius: 2,
  moveLimit: 16
};

function createAI({ boardSize = 15 } = {}) {
  const size = boardSize;

  const AI_ROLE = -1;
  const HUMAN_ROLE = 1;

  function findBestMove(board, aiRole = AI_ROLE, humanRole = HUMAN_ROLE, options = {}) {
    const config = Object.assign({}, DEFAULT_OPTIONS, options);
    const start = Date.now();
    let bestMove = null;
    let bestScore = -Infinity;
    for (let depth = 1; depth <= config.depth; depth += 1) {
      const result = alphaBetaSearch({
        board,
        depth,
        maxDepth: depth,
        alpha: -Infinity,
        beta: Infinity,
        currentRole: aiRole,
        aiRole,
        humanRole,
        start,
        timeLimit: config.timeLimit,
        lastMove: null,
        moveRadius: config.moveRadius,
        moveLimit: config.moveLimit
      });
      if (result.timeout) {
        break;
      }
      if (result.move) {
        bestMove = result.move;
        bestScore = result.score;
      }
      if (result.score >= SCORES.FIVE) {
        break;
      }
      if (Date.now() - start > config.timeLimit - 50) {
        break;
      }
    }

    if (!bestMove) {
      const candidates = generateMoves(board, {
        aiRole,
        humanRole,
        radius: config.moveRadius,
        limit: config.moveLimit
      });
      bestMove = candidates.length ? candidates[0] : { x: Math.floor(size / 2), y: Math.floor(size / 2) };
      bestScore = 0;
    }

    return {
      move: bestMove,
      score: bestScore
    };
  }

  function alphaBetaSearch(params) {
    const {
      board,
      depth,
      alpha,
      beta,
      currentRole,
      aiRole,
      humanRole,
      lastMove,
      start,
      timeLimit,
      maxDepth,
      moveRadius,
      moveLimit
    } = params;

    if (Date.now() - start >= timeLimit) {
      return { timeout: true, score: 0 };
    }

    let winner = 0;
    if (lastMove) {
      winner = checkWinner(board, lastMove);
      if (winner === aiRole) {
        return {
          timeout: false,
          score: SCORES.FIVE + depth,
          move: lastMove
        };
      }
      if (winner === humanRole) {
        return {
          timeout: false,
          score: -(SCORES.FIVE + depth),
          move: lastMove
        };
      }
    }

    if (depth === 0 || isBoardFull(board)) {
      return {
        timeout: false,
        score: evaluateBoard(board, aiRole, humanRole),
        move: lastMove
      };
    }

    let bestScore = currentRole === aiRole ? -Infinity : Infinity;
    let bestMove = null;
    let a = alpha;
    let b = beta;

    const moves = generateMoves(board, {
      aiRole,
      humanRole,
      radius: moveRadius,
      limit: moveLimit
    });

    if (!moves.length) {
      return {
        timeout: false,
        score: evaluateBoard(board, aiRole, humanRole),
        move: lastMove
      };
    }

    for (let i = 0; i < moves.length; i += 1) {
      const move = moves[i];
      board[move.x][move.y] = currentRole;
      const nextRole = currentRole === aiRole ? humanRole : aiRole;
      const result = alphaBetaSearch({
        board,
        depth: depth - 1,
        maxDepth,
        alpha: a,
        beta: b,
        currentRole: nextRole,
        aiRole,
        humanRole,
        lastMove: move,
        start,
        timeLimit,
        moveRadius,
        moveLimit
      });
      board[move.x][move.y] = 0;

      if (result.timeout) {
        return result;
      }

      if (currentRole === aiRole) {
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        a = Math.max(a, bestScore);
        if (a >= b) {
          break;
        }
      } else {
        if (result.score < bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        b = Math.min(b, bestScore);
        if (a >= b) {
          break;
        }
      }
    }

    return {
      timeout: false,
      score: bestScore,
      move: bestMove
    };
  }

  function generateMoves(board, { aiRole, humanRole, radius, limit }) {
    const candidates = [];
    let hasStone = false;

    for (let x = 0; x < size && !hasStone; x += 1) {
      for (let y = 0; y < size; y += 1) {
        if (board[x][y] !== 0) {
          hasStone = true;
          break;
        }
      }
    }

    if (!hasStone) {
      const center = Math.floor(size / 2);
      return [{ x: center, y: center, score: 0 }];
    }

    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        if (board[x][y] !== 0) {
          continue;
        }
        if (!hasNeighbor(board, x, y, radius)) {
          continue;
        }
        const attack = evaluatePoint(board, x, y, aiRole);
        const defense = evaluatePoint(board, x, y, humanRole);
        const score = Math.max(attack, defense) * 1.1 + Math.min(attack, defense);
        candidates.push({ x, y, score, attack, defense });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    if (typeof limit === 'number' && limit > 0 && candidates.length > limit) {
      return candidates.slice(0, limit);
    }
    return candidates;
  }

  function evaluateBoard(board, aiRole, humanRole) {
    const aiScore = evaluateRole(board, aiRole);
    const humanScore = evaluateRole(board, humanRole);
    return aiScore - humanScore;
  }

  function evaluateRole(board, role) {
    let score = 0;
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        if (board[x][y] !== role) {
          continue;
        }
        for (let i = 0; i < DIRECTIONS.length; i += 1) {
          const [dx, dy] = DIRECTIONS[i];
          const prevX = x - dx;
          const prevY = y - dy;
          if (inBounds(prevX, prevY) && board[prevX][prevY] === role) {
            continue;
          }
          score += scoreLine(board, x, y, dx, dy, role);
        }
      }
    }
    return score;
  }

  function scoreLine(board, x, y, dx, dy, role) {
    let count = 1;
    let openEnds = 0;

    let nx = x + dx;
    let ny = y + dy;
    while (inBounds(nx, ny) && board[nx][ny] === role) {
      count += 1;
      nx += dx;
      ny += dy;
    }
    if (inBounds(nx, ny) && board[nx][ny] === 0) {
      openEnds += 1;
    }

    nx = x - dx;
    ny = y - dy;
    while (inBounds(nx, ny) && board[nx][ny] === role) {
      count += 1;
      nx -= dx;
      ny -= dy;
    }
    if (inBounds(nx, ny) && board[nx][ny] === 0) {
      openEnds += 1;
    }

    if (count >= 5) {
      return SCORES.FIVE;
    }
    if (count === 4) {
      if (openEnds === 2) {
        return SCORES.OPEN_FOUR;
      }
      if (openEnds === 1) {
        return SCORES.BLOCKED_FOUR;
      }
    }
    if (count === 3) {
      if (openEnds === 2) {
        return SCORES.OPEN_THREE;
      }
      if (openEnds === 1) {
        return SCORES.BLOCKED_THREE;
      }
    }
    if (count === 2) {
      if (openEnds === 2) {
        return SCORES.OPEN_TWO;
      }
      if (openEnds === 1) {
        return SCORES.BLOCKED_TWO;
      }
    }
    if (count === 1 && openEnds > 0) {
      return SCORES.SINGLE;
    }
    return 0;
  }

  function evaluatePoint(board, x, y, role) {
    let total = 0;
    for (let i = 0; i < DIRECTIONS.length; i += 1) {
      const [dx, dy] = DIRECTIONS[i];
      const lineScore = scorePlacement(board, x, y, dx, dy, role);
      total += lineScore;
    }
    return total;
  }

  function scorePlacement(board, x, y, dx, dy, role) {
    let leftCount = 0;
    let leftOpen = false;
    let nx = x - dx;
    let ny = y - dy;
    while (inBounds(nx, ny) && board[nx][ny] === role) {
      leftCount += 1;
      nx -= dx;
      ny -= dy;
    }
    if (inBounds(nx, ny) && board[nx][ny] === 0) {
      leftOpen = true;
    }

    let rightCount = 0;
    let rightOpen = false;
    nx = x + dx;
    ny = y + dy;
    while (inBounds(nx, ny) && board[nx][ny] === role) {
      rightCount += 1;
      nx += dx;
      ny += dy;
    }
    if (inBounds(nx, ny) && board[nx][ny] === 0) {
      rightOpen = true;
    }

    const count = leftCount + rightCount + 1;
    const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);

    if (count >= 5) {
      return SCORES.FIVE;
    }
    if (count === 4) {
      if (openEnds === 2) {
        return SCORES.OPEN_FOUR;
      }
      if (openEnds === 1) {
        return SCORES.BLOCKED_FOUR;
      }
    }
    if (count === 3) {
      if (openEnds === 2) {
        return SCORES.OPEN_THREE;
      }
      if (openEnds === 1) {
        return SCORES.BLOCKED_THREE;
      }
    }
    if (count === 2) {
      if (openEnds === 2) {
        return SCORES.OPEN_TWO;
      }
      if (openEnds === 1) {
        return SCORES.BLOCKED_TWO;
      }
    }
    if (count === 1 && openEnds > 0) {
      return SCORES.SINGLE;
    }
    return 0;
  }

  function checkWinner(board, move) {
    if (!move) {
      return 0;
    }
    const { x, y } = move;
    const role = board[x][y];
    if (!role) {
      return 0;
    }
    for (let i = 0; i < DIRECTIONS.length; i += 1) {
      const [dx, dy] = DIRECTIONS[i];
      let count = 1;

      let nx = x + dx;
      let ny = y + dy;
      while (inBounds(nx, ny) && board[nx][ny] === role) {
        count += 1;
        nx += dx;
        ny += dy;
      }

      nx = x - dx;
      ny = y - dy;
      while (inBounds(nx, ny) && board[nx][ny] === role) {
        count += 1;
        nx -= dx;
        ny -= dy;
      }

      if (count >= 5) {
        return role;
      }
    }
    return 0;
  }

  function hasNeighbor(board, x, y, radius) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const nx = x + dx;
        const ny = y + dy;
        if (inBounds(nx, ny) && board[nx][ny] !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  function isBoardFull(board) {
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) {
        if (board[x][y] === 0) {
          return false;
        }
      }
    }
    return true;
  }

  function inBounds(x, y) {
    return x >= 0 && x < size && y >= 0 && y < size;
  }

  return {
    findBestMove,
    evaluateBoard,
    checkWinner
  };
}

module.exports = {
  createAI,
  SCORES
};
