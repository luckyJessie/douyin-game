/**
 * 豆芽五子棋AI算法实现
 * 使用Minimax算法 + Alpha-Beta剪枝优化
 */

class GomokuAI {
  constructor(depth = 4) {
    this.depth = depth; // 搜索深度
    this.aiPlayer = 1; // AI玩家（1为黑棋，2为白棋）
    this.humanPlayer = 2; // 人类玩家
  }

  /**
   * 设置AI玩家
   * @param {number} player - 1为黑棋，2为白棋
   */
  setAIPlayer(player) {
    this.aiPlayer = player;
    this.humanPlayer = player === 1 ? 2 : 1;
  }

  /**
   * 获取AI的最佳落子位置
   * @param {Array} board - 15x15的棋盘数组，0为空，1为黑棋，2为白棋
   * @returns {Object} {row, col} 最佳落子位置
   */
  getBestMove(board) {
    const moves = this.getPossibleMoves(board);
    if (moves.length === 0) {
      return { row: 7, col: 7 }; // 如果棋盘为空，返回中心位置
    }

    let bestMove = null;
    let bestValue = -Infinity;

    // 对可能的落子位置进行排序，优先考虑有威胁的位置
    const sortedMoves = this.sortMoves(board, moves);

    for (const move of sortedMoves) {
      board[move.row][move.col] = this.aiPlayer;
      const value = this.minimax(board, this.depth - 1, false, -Infinity, Infinity);
      board[move.row][move.col] = 0; // 恢复棋盘

      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }
    }

    return bestMove || sortedMoves[0];
  }

  /**
   * Minimax算法 + Alpha-Beta剪枝
   * @param {Array} board - 棋盘状态
   * @param {number} depth - 搜索深度
   * @param {boolean} isMaximizing - 是否为最大化玩家（AI）
   * @param {number} alpha - Alpha值
   * @param {number} beta - Beta值
   * @returns {number} 评估值
   */
  minimax(board, depth, isMaximizing, alpha, beta) {
    // 检查游戏是否结束
    const winner = this.checkWinner(board);
    if (winner === this.aiPlayer) {
      return 10000 + depth; // 深度越大，分数越低（鼓励快速获胜）
    } else if (winner === this.humanPlayer) {
      return -10000 - depth;
    }

    // 如果达到最大深度，返回评估值
    if (depth === 0) {
      return this.evaluateBoard(board);
    }

    const moves = this.getPossibleMoves(board);
    if (moves.length === 0) {
      return 0; // 平局
    }

    if (isMaximizing) {
      // AI回合，最大化分数
      let maxValue = -Infinity;
      for (const move of moves) {
        board[move.row][move.col] = this.aiPlayer;
        const value = this.minimax(board, depth - 1, false, alpha, beta);
        board[move.row][move.col] = 0;
        maxValue = Math.max(maxValue, value);
        alpha = Math.max(alpha, value);
        if (beta <= alpha) {
          break; // Alpha-Beta剪枝
        }
      }
      return maxValue;
    } else {
      // 人类回合，最小化分数
      let minValue = Infinity;
      for (const move of moves) {
        board[move.row][move.col] = this.humanPlayer;
        const value = this.minimax(board, depth - 1, true, alpha, beta);
        board[move.row][move.col] = 0;
        minValue = Math.min(minValue, value);
        beta = Math.min(beta, value);
        if (beta <= alpha) {
          break; // Alpha-Beta剪枝
        }
      }
      return minValue;
    }
  }

  /**
   * 评估棋盘局面
   * @param {Array} board - 棋盘状态
   * @returns {number} 评估分数
   */
  evaluateBoard(board) {
    let score = 0;
    const size = board.length;

    // 评估所有方向（水平、垂直、两个对角线）
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] !== 0) {
          continue;
        }

        // 评估这个位置对AI的价值
        const aiScore = this.evaluatePosition(board, row, col, this.aiPlayer);
        // 评估这个位置对人类的价值
        const humanScore = this.evaluatePosition(board, row, col, this.humanPlayer);

        score += aiScore - humanScore * 0.9; // 防守时稍微降低权重
      }
    }

    return score;
  }

  /**
   * 评估某个位置对特定玩家的价值
   * @param {Array} board - 棋盘状态
   * @param {number} row - 行坐标
   * @param {number} col - 列坐标
   * @param {number} player - 玩家（1或2）
   * @returns {number} 评估分数
   */
  evaluatePosition(board, row, col, player) {
    let score = 0;
    const directions = [
      [0, 1],   // 水平
      [1, 0],   // 垂直
      [1, 1],   // 主对角线
      [1, -1]   // 副对角线
    ];

    for (const [dx, dy] of directions) {
      const lineScore = this.evaluateLine(board, row, col, dx, dy, player);
      score += lineScore;
    }

    return score;
  }

  /**
   * 评估某个方向上的连子情况
   * @param {Array} board - 棋盘状态
   * @param {number} row - 行坐标
   * @param {number} col - 列坐标
   * @param {number} dx - 方向x增量
   * @param {number} dy - 方向y增量
   * @param {number} player - 玩家
   * @returns {number} 评估分数
   */
  evaluateLine(board, row, col, dx, dy, player) {
    let score = 0;
    let count = 0; // 连续棋子数
    let blocked = 0; // 被阻挡的端点数（0、1或2）

    // 向前检查
    let r = row + dx;
    let c = col + dy;
    let forwardBlocked = false;
    let forwardCount = 0;

    while (this.isValidPosition(r, c, board.length) && board[r][c] === player) {
      forwardCount++;
      r += dx;
      c += dy;
    }
    if (!this.isValidPosition(r, c, board.length) || board[r][c] !== 0) {
      forwardBlocked = true;
    }

    // 向后检查
    r = row - dx;
    c = col - dy;
    let backwardBlocked = false;
    let backwardCount = 0;

    while (this.isValidPosition(r, c, board.length) && board[r][c] === player) {
      backwardCount++;
      r -= dx;
      c -= dy;
    }
    if (!this.isValidPosition(r, c, board.length) || board[r][c] !== 0) {
      backwardBlocked = true;
    }

    count = forwardCount + backwardCount;
    blocked = (forwardBlocked ? 1 : 0) + (backwardBlocked ? 1 : 0);

    // 根据连子数和阻挡情况评分
    if (count >= 4) {
      score += 10000; // 五连
    } else if (count === 3 && blocked === 0) {
      score += 1000; // 活四
    } else if (count === 3 && blocked === 1) {
      score += 100; // 冲四
    } else if (count === 2 && blocked === 0) {
      score += 10; // 活三
    } else if (count === 2 && blocked === 1) {
      score += 1; // 眠三
    } else if (count === 1 && blocked === 0) {
      score += 0.1; // 活二
    }

    return score;
  }

  /**
   * 检查位置是否有效
   */
  isValidPosition(row, col, size) {
    return row >= 0 && row < size && col >= 0 && col < size;
  }

  /**
   * 获取所有可能的落子位置（只考虑已有棋子周围的位置）
   * @param {Array} board - 棋盘状态
   * @returns {Array} 可能的落子位置数组
   */
  getPossibleMoves(board) {
    const moves = [];
    const size = board.length;
    const used = new Set();

    // 如果棋盘为空，返回中心位置
    let hasPiece = false;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] !== 0) {
          hasPiece = true;
          // 检查周围8个方向的位置
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const newRow = row + dr;
              const newCol = col + dc;
              if (this.isValidPosition(newRow, newCol, size) && 
                  board[newRow][newCol] === 0) {
                const key = `${newRow},${newCol}`;
                if (!used.has(key)) {
                  used.add(key);
                  moves.push({ row: newRow, col: newCol });
                }
              }
            }
          }
        }
      }
    }

    if (!hasPiece) {
      return [{ row: 7, col: 7 }]; // 返回中心位置
    }

    return moves;
  }

  /**
   * 对可能的落子位置进行排序，优先考虑威胁大的位置
   * @param {Array} board - 棋盘状态
   * @param {Array} moves - 可能的落子位置
   * @returns {Array} 排序后的落子位置
   */
  sortMoves(board, moves) {
    return moves.sort((a, b) => {
      const scoreA = this.evaluatePosition(board, a.row, a.col, this.aiPlayer) +
                     this.evaluatePosition(board, a.row, a.col, this.humanPlayer);
      const scoreB = this.evaluatePosition(board, b.row, b.col, this.aiPlayer) +
                     this.evaluatePosition(board, b.row, b.col, this.humanPlayer);
      return scoreB - scoreA; // 降序排列
    }).slice(0, 20); // 只考虑前20个最佳位置，提高效率
  }

  /**
   * 检查是否有玩家获胜
   * @param {Array} board - 棋盘状态
   * @returns {number} 0表示未结束，1表示黑棋胜，2表示白棋胜
   */
  checkWinner(board) {
    const size = board.length;
    const directions = [
      [0, 1],   // 水平
      [1, 0],   // 垂直
      [1, 1],   // 主对角线
      [1, -1]   // 副对角线
    ];

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (board[row][col] === 0) continue;

        const player = board[row][col];
        for (const [dx, dy] of directions) {
          let count = 1;
          let r = row + dx;
          let c = col + dy;

          while (this.isValidPosition(r, c, size) && board[r][c] === player) {
            count++;
            r += dx;
            c += dy;
          }

          if (count >= 5) {
            return player;
          }
        }
      }
    }

    return 0;
  }
}

// 导出供微信小程序使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GomokuAI;
}
