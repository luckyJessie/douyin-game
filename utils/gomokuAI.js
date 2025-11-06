class GomokuAI {
  constructor(boardSize = 15, humanStone = 1, aiStone = -1, maxDepth = 3) {
    this.boardSize = boardSize;
    this.humanStone = humanStone;
    this.aiStone = aiStone;
    this.maxDepth = maxDepth;
    this.maxCandidates = 12;
    this.useIterativeDeepening = false;
    this.timeLimit = 0;
    this.zobristTable = null;
    this.zobristSize = null;
    this.transpositionTable = new Map();
  }

  searchBestMove(board) {
    this.boardSize = board.length;

    this.ensureZobrist(this.boardSize);
    this.resetCache();

    const candidates = this._generateCandidates(board, this.aiStone);
    if (candidates.length === 0) {
      return null;
    }

    const baseHash = this._hashBoard(board);
    const startTime = Date.now();
    const moveScores = new Map();

    const evaluateMove = (move, depth) => {
      const hashAfterMove = this._toggleZobrist(baseHash, move.row, move.col, this.aiStone);
      board[move.row][move.col] = this.aiStone;

      let score;
      if (this._isWinningMove(board, move.row, move.col, this.aiStone)) {
        score = 9000000 + depth * 10;
      } else {
        score = this._alphaBeta(board, depth - 1, -Infinity, Infinity, false, move, this.aiStone, hashAfterMove, startTime);
      }

      board[move.row][move.col] = 0;
      return score;
    };

    const pickBestFromCandidates = depth => {
      let bestScore = -Infinity;
      let bestMove = candidates[0];
      for (const move of candidates) {
        const score = evaluateMove(move, depth);
        const key = `${move.row}_${move.col}`;
        moveScores.set(key, score);
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        if (this.timeLimit > 0 && Date.now() - startTime > this.timeLimit) {
          break;
        }
      }
      return { bestScore, bestMove };
    };

    if (this.useIterativeDeepening && this.maxDepth > 1) {
      let globalBestMove = candidates[0];
      let globalBestScore = -Infinity;
      let timeExceeded = false;

      for (let depth = 1; depth <= this.maxDepth; depth++) {
        const sortedCandidates = depth === 1
          ? candidates.slice(0)
          : candidates.slice(0).sort((a, b) => {
            const keyA = `${a.row}_${a.col}`;
            const keyB = `${b.row}_${b.col}`;
            return (moveScores.get(keyB) || -Infinity) - (moveScores.get(keyA) || -Infinity);
          });

        candidates.splice(0, candidates.length, ...sortedCandidates);

        let iterationBestScore = -Infinity;
        let iterationBestMove = candidates[0];
        for (const move of candidates) {
          const score = evaluateMove(move, depth);
          const key = `${move.row}_${move.col}`;
          moveScores.set(key, score);
          if (score > iterationBestScore) {
            iterationBestScore = score;
            iterationBestMove = move;
          }
          if (this.timeLimit > 0 && Date.now() - startTime > this.timeLimit) {
            timeExceeded = true;
            break;
          }
        }

        if (iterationBestScore > globalBestScore) {
          globalBestScore = iterationBestScore;
          globalBestMove = iterationBestMove;
        }

        if (timeExceeded) {
          break;
        }
      }

      return globalBestMove;
    }

    const { bestMove } = pickBestFromCandidates(this.maxDepth);
    return bestMove;
  }

  _alphaBeta(board, depth, alpha, beta, maximizingPlayer, lastMove, lastPlayer, hash, startTime) {
    if (lastMove && this._isWinningMove(board, lastMove.row, lastMove.col, lastPlayer)) {
      const winScore = lastPlayer === this.aiStone ? 10000000 : -10000000;
      return winScore + depth;
    }

    if (depth === 0 || this._isBoardFull(board)) {
      return this._evaluateBoard(board);
    }

    if (this.timeLimit > 0 && startTime && Date.now() - startTime > this.timeLimit) {
      return this._evaluateBoard(board);
    }

    const hashKey = typeof hash === 'bigint' ? hash.toString() : hash;
    if (hashKey && this.transpositionTable.has(hashKey)) {
      const entry = this.transpositionTable.get(hashKey);
      if (entry.depth >= depth) {
        if (entry.flag === 'exact') {
          return entry.value;
        }
        if (entry.flag === 'lower' && entry.value > alpha) {
          alpha = entry.value;
        } else if (entry.flag === 'upper' && entry.value < beta) {
          beta = entry.value;
        }
        if (alpha >= beta) {
          return entry.value;
        }
      }
    }

    const currentPlayer = maximizingPlayer ? this.aiStone : this.humanStone;
    const candidates = this._generateCandidates(board, currentPlayer);

    if (candidates.length === 0) {
      return this._evaluateBoard(board);
    }

    let bestValue;
    let flag = 'exact';
    if (maximizingPlayer) {
      bestValue = -Infinity;
      for (const move of candidates) {
        board[move.row][move.col] = currentPlayer;
        const nextHash = hashKey != null ? this._toggleZobrist(hash, move.row, move.col, currentPlayer) : undefined;
        const score = this._alphaBeta(board, depth - 1, alpha, beta, false, move, currentPlayer, nextHash, startTime);
        board[move.row][move.col] = 0;

        if (score > bestValue) {
          bestValue = score;
        }
        if (score > alpha) {
          alpha = score;
        }
        if (alpha >= beta) {
          flag = 'lower';
          break;
        }
      }
    } else {
      bestValue = Infinity;
      for (const move of candidates) {
        board[move.row][move.col] = currentPlayer;
        const nextHash = hashKey != null ? this._toggleZobrist(hash, move.row, move.col, currentPlayer) : undefined;
        const score = this._alphaBeta(board, depth - 1, alpha, beta, true, move, currentPlayer, nextHash, startTime);
        board[move.row][move.col] = 0;

        if (score < bestValue) {
          bestValue = score;
        }
        if (score < beta) {
          beta = score;
        }
        if (alpha >= beta) {
          flag = 'upper';
          break;
        }
      }
    }

    if (hashKey) {
      this.transpositionTable.set(hashKey, {
        depth,
        value: bestValue,
        flag
      });
    }

    return bestValue;
  }

  _generateCandidates(board, player) {
    const candidates = [];
    const size = this.boardSize;
    if (this._isBoardEmpty(board)) {
      const center = Math.floor(size / 2);
      return [{ row: center, col: center, score: 0 }];
    }

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] !== 0) continue;
        if (!this._hasNeighbor(board, row, col, 2)) continue;

        board[row][col] = player;
        const heuristic = this._evaluateLocal(board, row, col, player);
        board[row][col] = 0;

        candidates.push({ row, col, score: heuristic });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, this.maxCandidates);
  }

  _evaluateBoard(board) {
    let score = 0;
    const lines = this._enumerateLines(board);

    for (const line of lines) {
      score += this._evaluateLine(line, this.aiStone);
      score -= this._evaluateLine(line, this.humanStone);
    }

    return score;
  }

  _evaluateLocal(board, row, col, player) {
    let score = 0;
    const directions = [
      { dr: 1, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 }
    ];

    for (const { dr, dc } of directions) {
      const line = this._extractLine(board, row, col, dr, dc);
      score += this._evaluateLine(line, player);
    }

    return score;
  }

  _evaluateLine(line, role) {
    const continuous = this._analyzeContinuousSequences(line, role);
    const gapped = this._analyzeGappedPatterns(line, role);
    let score = continuous.score + gapped.score;

    const patterns = this._mergePatternStats(continuous.patterns, gapped.patterns);

    if (patterns.five > 0) {
      score += 900000;
    }
    if (patterns.openFour >= 2) {
      score += 240000;
    }
    if (patterns.openThree >= 2 && patterns.openFour === 0) {
      score += 45000;
    }
    if (patterns.openThree > 0 && patterns.halfOpenFour > 0) {
      score += 18000;
    }
    if (patterns.gappedFour > 0) {
      score += 12000;
    }

    return score;
  }

  _analyzeContinuousSequences(line, role) {
    let score = 0;
    const len = line.length;
    const patterns = this._createPatternStats();

    for (let i = 0; i < len; i++) {
      if (line[i] !== role) continue;

      let count = 0;
      let j = i;
      while (j < len && line[j] === role) {
        count++;
        j++;
      }

      const leftCell = i - 1 >= 0 ? line[i - 1] : null;
      const rightCell = j < len ? line[j] : null;
      const leftOpen = leftCell === 0;
      const rightOpen = rightCell === 0;
      const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);

      if (count >= 5) {
        score += 1000000;
        patterns.five += 1;
      } else if (count === 4) {
        if (openEnds === 2) {
          score += 120000;
          patterns.openFour += 1;
        } else if (openEnds === 1) {
          score += 15000;
          patterns.halfOpenFour += 1;
        } else {
          score += 1500;
        }
      } else if (count === 3) {
        if (openEnds === 2) {
          score += 6000;
          patterns.openThree += 1;
        } else if (openEnds === 1) {
          score += 900;
          patterns.halfOpenThree += 1;
        } else {
          score += 90;
        }
      } else if (count === 2) {
        if (openEnds === 2) {
          score += 400;
          patterns.openTwo += 1;
        } else if (openEnds === 1) {
          score += 70;
          patterns.halfOpenTwo += 1;
        } else {
          score += 10;
        }
      } else if (count === 1) {
        if (openEnds === 2) {
          score += 40;
        } else if (openEnds === 1) {
          score += 4;
        }
      }

      i = j - 1;
    }

    return { score, patterns };
  }

  _analyzeGappedPatterns(line, role) {
    let score = 0;
    const len = line.length;
    const patterns = this._createPatternStats();

    for (let i = 0; i < len; i++) {
      if (line[i] !== role) continue;

      const leftCell = i - 1 >= 0 ? line[i - 1] : null;

      // Pattern: role role 0 role role
      if ((leftCell !== role) && i + 4 < len && line[i + 1] === role && line[i + 2] === 0 && line[i + 3] === role && line[i + 4] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 5 < len ? line[i + 5] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        patterns.gappedFour += 1;
        if (openEnds === 2) {
          score += 90000;
          patterns.openFour += 1;
        } else if (openEnds === 1) {
          score += 12000;
          patterns.halfOpenFour += 1;
        } else {
          score += 1500;
        }
      }

      // Pattern: role role role 0 role
      if ((leftCell !== role) && i + 4 < len && line[i + 1] === role && line[i + 2] === role && line[i + 3] === 0 && line[i + 4] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 5 < len ? line[i + 5] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) {
          score += 7000;
          patterns.openThree += 1;
        } else if (openEnds === 1) {
          score += 900;
          patterns.halfOpenThree += 1;
        } else {
          score += 90;
        }
      }

      // Pattern: role 0 role role role
      if ((leftCell !== role) && i + 4 < len && line[i + 1] === 0 && line[i + 2] === role && line[i + 3] === role && line[i + 4] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 5 < len ? line[i + 5] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) {
          score += 7000;
          patterns.openThree += 1;
        } else if (openEnds === 1) {
          score += 900;
          patterns.halfOpenThree += 1;
        } else {
          score += 90;
        }
      }

      // Pattern: role role 0 role
      if ((leftCell !== role) && i + 3 < len && line[i + 1] === role && line[i + 2] === 0 && line[i + 3] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 4 < len ? line[i + 4] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) {
          score += 3500;
          patterns.openTwo += 1;
        } else if (openEnds === 1) {
          score += 450;
          patterns.halfOpenTwo += 1;
        } else {
          score += 45;
        }
      }

      // Pattern: role 0 role role
      if ((leftCell !== role) && i + 3 < len && line[i + 1] === 0 && line[i + 2] === role && line[i + 3] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 4 < len ? line[i + 4] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) {
          score += 3500;
          patterns.openTwo += 1;
        } else if (openEnds === 1) {
          score += 450;
          patterns.halfOpenTwo += 1;
        } else {
          score += 45;
        }
      }
    }

    return { score, patterns };
  }

  _createPatternStats() {
    return {
      five: 0,
      openFour: 0,
      halfOpenFour: 0,
      openThree: 0,
      halfOpenThree: 0,
      openTwo: 0,
      halfOpenTwo: 0,
      gappedFour: 0,
      gappedThree: 0
    };
  }

  _mergePatternStats(a, b) {
    const result = this._createPatternStats();
    const keys = Object.keys(result);
    keys.forEach(key => {
      result[key] = (a[key] || 0) + (b[key] || 0);
    });
    return result;
  }

  _isWinningMove(board, row, col, player) {
    if (row == null || col == null) return false;
    const directions = [
      { dr: 1, dc: 0 },
      { dr: 0, dc: 1 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: -1 }
    ];

    for (const { dr, dc } of directions) {
      let count = 1;
      count += this._countDirection(board, row, col, dr, dc, player);
      count += this._countDirection(board, row, col, -dr, -dc, player);
      if (count >= 5) {
        return true;
      }
    }
    return false;
  }

  _countDirection(board, row, col, dr, dc, player) {
    let count = 0;
    let r = row + dr;
    let c = col + dc;
    const size = this.boardSize;

    while (r >= 0 && c >= 0 && r < size && c < size && board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }

    return count;
  }

  _isBoardFull(board) {
    for (let row = 0; row < this.boardSize; row++) {
      for (let col = 0; col < this.boardSize; col++) {
        if (board[row][col] === 0) return false;
      }
    }
    return true;
  }

  _isBoardEmpty(board) {
    for (let row = 0; row < this.boardSize; row++) {
      for (let col = 0; col < this.boardSize; col++) {
        if (board[row][col] !== 0) return false;
      }
    }
    return true;
  }

  _hasNeighbor(board, row, col, distance = 1) {
    for (let dr = -distance; dr <= distance; dr++) {
      for (let dc = -distance; dc <= distance; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (nr < 0 || nc < 0 || nr >= this.boardSize || nc >= this.boardSize) continue;
        if (board[nr][nc] !== 0) return true;
      }
    }
    return false;
  }

  _enumerateLines(board) {
    const lines = [];

    // Rows
    for (let row = 0; row < this.boardSize; row++) {
      lines.push(board[row].slice());
    }

    // Columns
    for (let col = 0; col < this.boardSize; col++) {
      const column = [];
      for (let row = 0; row < this.boardSize; row++) {
        column.push(board[row][col]);
      }
      lines.push(column);
    }

    // Diagonals (top-left to bottom-right)
    for (let k = -(this.boardSize - 5); k <= this.boardSize - 5; k++) {
      const diag = [];
      for (let row = 0; row < this.boardSize; row++) {
        const col = row + k;
        if (col >= 0 && col < this.boardSize) {
          diag.push(board[row][col]);
        }
      }
      if (diag.length >= 5) {
        lines.push(diag);
      }
    }

    // Anti-diagonals (top-right to bottom-left)
    for (let k = 4; k <= 2 * this.boardSize - 5; k++) {
      const diag = [];
      for (let row = 0; row < this.boardSize; row++) {
        const col = k - row;
        if (col >= 0 && col < this.boardSize) {
          diag.push(board[row][col]);
        }
      }
      if (diag.length >= 5) {
        lines.push(diag);
      }
    }

    return lines;
  }

  _extractLine(board, row, col, dr, dc) {
    const line = [];
    let r = row;
    let c = col;

    while (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize) {
      line.unshift(board[r][c]);
      r -= dr;
      c -= dc;
    }

    r = row + dr;
    c = col + dc;

    while (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize) {
      line.push(board[r][c]);
      r += dr;
      c += dc;
    }

    return line;
  }

  configure(options = {}) {
    if (typeof options.maxDepth === 'number') {
      this.maxDepth = Math.max(1, options.maxDepth);
    }
    if (typeof options.maxCandidates === 'number') {
      this.maxCandidates = Math.max(4, options.maxCandidates);
    }
    if (typeof options.useIterativeDeepening === 'boolean') {
      this.useIterativeDeepening = options.useIterativeDeepening;
    }
    if (typeof options.timeLimit === 'number') {
      this.timeLimit = Math.max(0, options.timeLimit);
    }
  }

  ensureZobrist(size = this.boardSize) {
    if (this.zobristTable && this.zobristSize === size) {
      return;
    }
    this.zobristTable = [];
    for (let row = 0; row < size; row++) {
      const rowTable = [];
      for (let col = 0; col < size; col++) {
        rowTable.push([
          this._randomZobristValue(),
          this._randomZobristValue()
        ]);
      }
      this.zobristTable.push(rowTable);
    }
    this.zobristSize = size;
  }

  resetCache() {
    this.transpositionTable.clear();
  }

  _hashBoard(board) {
    this.ensureZobrist(board.length);
    let hash = 0n;
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board.length; col++) {
        const value = board[row][col];
        if (value === 0) continue;
        const idx = value === this.humanStone ? 0 : 1;
        hash ^= BigInt(this.zobristTable[row][col][idx]);
      }
    }
    return hash;
  }

  _toggleZobrist(hash, row, col, player) {
    if (hash == null) return undefined;
    const idx = player === this.humanStone ? 0 : 1;
    return hash ^ BigInt(this.zobristTable[row][col][idx]);
  }

  _randomZobristValue() {
    const value = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    return value === 0 ? 1 : value;
  }
}

module.exports = GomokuAI;
