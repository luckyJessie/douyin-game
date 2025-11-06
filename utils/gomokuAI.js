class GomokuAI {
  constructor(boardSize = 15, humanStone = 1, aiStone = -1, maxDepth = 3) {
    this.boardSize = boardSize;
    this.humanStone = humanStone;
    this.aiStone = aiStone;
    this.maxDepth = maxDepth;
    this.maxCandidates = 12;
  }

  searchBestMove(board) {
    this.boardSize = board.length;

    const candidates = this._generateCandidates(board, this.aiStone);
    if (candidates.length === 0) {
      return null;
    }

    let bestScore = -Infinity;
    let bestMove = candidates[0];

    for (const move of candidates) {
      board[move.row][move.col] = this.aiStone;

      if (this._isWinningMove(board, move.row, move.col, this.aiStone)) {
        board[move.row][move.col] = 0;
        return move;
      }

      const score = this._alphaBeta(board, this.maxDepth - 1, -Infinity, Infinity, false, move, this.aiStone);
      board[move.row][move.col] = 0;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  _alphaBeta(board, depth, alpha, beta, maximizingPlayer, lastMove, lastPlayer) {
    if (lastMove && this._isWinningMove(board, lastMove.row, lastMove.col, lastPlayer)) {
      const winScore = lastPlayer === this.aiStone ? 10000000 : -10000000;
      return winScore + depth;
    }

    if (depth === 0 || this._isBoardFull(board)) {
      return this._evaluateBoard(board);
    }

    const currentPlayer = maximizingPlayer ? this.aiStone : this.humanStone;
    const candidates = this._generateCandidates(board, currentPlayer);

    if (candidates.length === 0) {
      return this._evaluateBoard(board);
    }

    if (maximizingPlayer) {
      let value = -Infinity;
      for (const move of candidates) {
        board[move.row][move.col] = currentPlayer;
        const score = this._alphaBeta(board, depth - 1, alpha, beta, false, move, currentPlayer);
        board[move.row][move.col] = 0;

        value = Math.max(value, score);
        alpha = Math.max(alpha, value);
        if (alpha >= beta) {
          break;
        }
      }
      return value;
    }

    let value = Infinity;
    for (const move of candidates) {
      board[move.row][move.col] = currentPlayer;
      const score = this._alphaBeta(board, depth - 1, alpha, beta, true, move, currentPlayer);
      board[move.row][move.col] = 0;

      value = Math.min(value, score);
      beta = Math.min(beta, value);
      if (alpha >= beta) {
        break;
      }
    }
    return value;
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
    let score = 0;

    score += this._scoreContinuousSequences(line, role);
    score += this._scoreGappedPatterns(line, role);

    return score;
  }

  _scoreContinuousSequences(line, role) {
    let score = 0;
    const len = line.length;

    for (let i = 0; i < len; i++) {
      if (line[i] !== role) continue;

      let count = 0;
      let j = i;
      while (j < len && line[j] === role) {
        count++;
        j++;
      }

      const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
      const rightOpen = j < len ? line[j] === 0 : false;

      score += this._sequenceScore(count, leftOpen, rightOpen);

      i = j - 1;
    }

    return score;
  }

  _scoreGappedPatterns(line, role) {
    let score = 0;
    const len = line.length;

    for (let i = 0; i < len; i++) {
      if (line[i] !== role) continue;

      const leftCell = i - 1 >= 0 ? line[i - 1] : null;

      // Pattern: role role 0 role role
      if ((leftCell !== role) && i + 4 < len && line[i + 1] === role && line[i + 2] === 0 && line[i + 3] === role && line[i + 4] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 5 < len ? line[i + 5] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) score += 90000;
        else if (openEnds === 1) score += 9000;
        else score += 1200;
      }

      // Pattern: role role role 0 role
      if ((leftCell !== role) && i + 4 < len && line[i + 1] === role && line[i + 2] === role && line[i + 3] === 0 && line[i + 4] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 5 < len ? line[i + 5] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) score += 6000;
        else if (openEnds === 1) score += 800;
        else score += 80;
      }

      // Pattern: role 0 role role role
      if ((leftCell !== role) && i + 4 < len && line[i + 1] === 0 && line[i + 2] === role && line[i + 3] === role && line[i + 4] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 5 < len ? line[i + 5] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) score += 6000;
        else if (openEnds === 1) score += 800;
        else score += 80;
      }

      // Pattern: role role 0 role
      if ((leftCell !== role) && i + 3 < len && line[i + 1] === role && line[i + 2] === 0 && line[i + 3] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 4 < len ? line[i + 4] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) score += 4000;
        else if (openEnds === 1) score += 400;
        else score += 40;
      }

      // Pattern: role 0 role role
      if ((leftCell !== role) && i + 3 < len && line[i + 1] === 0 && line[i + 2] === role && line[i + 3] === role) {
        const leftOpen = i - 1 >= 0 ? line[i - 1] === 0 : false;
        const rightOpen = i + 4 < len ? line[i + 4] === 0 : false;
        const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);
        if (openEnds === 2) score += 4000;
        else if (openEnds === 1) score += 400;
        else score += 40;
      }
    }

    return score;
  }

  _sequenceScore(count, leftOpen, rightOpen) {
    const openEnds = (leftOpen ? 1 : 0) + (rightOpen ? 1 : 0);

    if (count >= 5) return 1000000;
    if (count === 4) {
      if (openEnds === 2) return 100000;
      if (openEnds === 1) return 12000;
      return 1000;
    }
    if (count === 3) {
      if (openEnds === 2) return 6000;
      if (openEnds === 1) return 700;
      return 70;
    }
    if (count === 2) {
      if (openEnds === 2) return 400;
      if (openEnds === 1) return 60;
      return 6;
    }
    if (count === 1) {
      if (openEnds === 2) return 40;
      if (openEnds === 1) return 4;
    }
    return 0;
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
}

module.exports = GomokuAI;
