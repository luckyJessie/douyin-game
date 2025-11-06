/**
 * 五子棋AI - 使用Minimax算法 + Alpha-Beta剪枝
 */
class AI {
  constructor(board, aiPlayer, humanPlayer) {
    this.board = board.map(r => [...r])
    this.aiPlayer = aiPlayer // AI玩家（通常为2）
    this.humanPlayer = humanPlayer // 人类玩家（通常为1）
    this.depth = 3 // 搜索深度
    this.size = board.length
  }

  // 获取最佳落子位置
  getBestMove() {
    const moves = this.getValidMoves()
    if (moves.length === 0) {
      return null
    }

    // 如果第一步，随机选择中心附近位置
    if (this.isBoardEmpty()) {
      const center = Math.floor(this.size / 2)
      const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]
      const offset = offsets[Math.floor(Math.random() * offsets.length)]
      return { row: center + offset[0], col: center + offset[1] }
    }

    let bestMove = null
    let bestValue = -Infinity

    // 使用Alpha-Beta剪枝的Minimax算法
    for (let move of moves) {
      this.board[move.row][move.col] = this.aiPlayer
      
      const value = this.minimax(this.board, this.depth - 1, false, -Infinity, Infinity)
      
      this.board[move.row][move.col] = 0

      if (value > bestValue) {
        bestValue = value
        bestMove = move
      }
    }

    return bestMove
  }

  // Minimax算法（带Alpha-Beta剪枝）
  minimax(board, depth, isMaximizing, alpha, beta) {
    // 检查游戏是否结束
    const winner = this.checkWinner(board)
    if (winner === this.aiPlayer) {
      return 10000 + depth // 深度越浅，分数越高
    }
    if (winner === this.humanPlayer) {
      return -10000 - depth // AI输，分数极低
    }

    // 达到最大深度或棋盘已满，使用评估函数
    if (depth === 0 || this.isBoardFull(board)) {
      return this.evaluate(board)
    }

    const moves = this.getValidMovesNearPieces(board)

    if (isMaximizing) {
      // AI回合，选择最大值
      let maxValue = -Infinity
      for (let move of moves) {
        board[move.row][move.col] = this.aiPlayer
        
        const value = this.minimax(board, depth - 1, false, alpha, beta)
        
        board[move.row][move.col] = 0
        
        maxValue = Math.max(maxValue, value)
        alpha = Math.max(alpha, value)
        
        // Alpha-Beta剪枝
        if (beta <= alpha) {
          break
        }
      }
      return maxValue
    } else {
      // 人类回合，选择最小值
      let minValue = Infinity
      for (let move of moves) {
        board[move.row][move.col] = this.humanPlayer
        
        const value = this.minimax(board, depth - 1, true, alpha, beta)
        
        board[move.row][move.col] = 0
        
        minValue = Math.min(minValue, value)
        beta = Math.min(beta, value)
        
        // Alpha-Beta剪枝
        if (beta <= alpha) {
          break
        }
      }
      return minValue
    }
  }

  // 评估函数：评估当前棋盘局面的得分
  evaluate(board) {
    let score = 0

    // 评估AI和人类的所有连子情况
    score += this.evaluateLines(board, this.aiPlayer) * 10
    score -= this.evaluateLines(board, this.humanPlayer) * 10

    // 评估威胁（能形成五连的位置）
    score += this.evaluateThreats(board, this.aiPlayer) * 100
    score -= this.evaluateThreats(board, this.humanPlayer) * 100

    return score
  }

  // 评估连子情况
  evaluateLines(board, player) {
    let score = 0
    const directions = [
      [[0, 1], [0, -1]],   // 水平
      [[1, 0], [-1, 0]],   // 垂直
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ]

    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] === player) {
          for (let dir of directions) {
            const lineScore = this.evaluateLine(board, i, j, dir, player)
            score += lineScore
          }
        }
      }
    }

    return score
  }

  // 评估一条线上的连子得分
  evaluateLine(board, row, col, directions, player) {
    let totalLength = 1
    let blocked = 0

    for (let dir of directions) {
      let length = 0
      let r = row + dir[0]
      let c = col + dir[1]
      
      while (
        r >= 0 && r < this.size &&
        c >= 0 && c < this.size &&
        board[r][c] === player
      ) {
        length++
        r += dir[0]
        c += dir[1]
      }
      
      // 检查是否被阻挡
      if (
        r < 0 || r >= this.size ||
        c < 0 || c >= this.size ||
        board[r][c] !== 0
      ) {
        blocked++
      }
      
      totalLength += length
    }

    // 根据连子长度和阻挡情况给分
    if (totalLength >= 5) return 1000
    if (totalLength === 4 && blocked === 0) return 100  // 活四
    if (totalLength === 4 && blocked === 1) return 50   // 冲四
    if (totalLength === 3 && blocked === 0) return 10   // 活三
    if (totalLength === 3 && blocked === 1) return 5    // 眠三
    if (totalLength === 2 && blocked === 0) return 2    // 活二
    return 1
  }

  // 评估威胁（可以形成五连的位置）
  evaluateThreats(board, player) {
    let threatCount = 0
    
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] === 0) {
          // 模拟落子
          board[i][j] = player
          // 检查是否能形成五连
          if (this.checkWinner(board, i, j) === player) {
            threatCount++
          }
          // 恢复
          board[i][j] = 0
        }
      }
    }
    
    return threatCount
  }

  // 获取有效落子位置（所有空位）
  getValidMoves() {
    const moves = []
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (this.board[i][j] === 0) {
          moves.push({ row: i, col: j })
        }
      }
    }
    return moves
  }

  // 获取有效落子位置（仅在有棋子附近的位置）
  getValidMovesNearPieces(board) {
    const moves = []
    const searched = new Set()

    // 查找所有已有棋子
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] !== 0) {
          // 查找周围2格内的空位
          for (let di = -2; di <= 2; di++) {
            for (let dj = -2; dj <= 2; dj++) {
              const ni = i + di
              const nj = j + dj
              const key = `${ni},${nj}`
              
              if (
                ni >= 0 && ni < this.size &&
                nj >= 0 && nj < this.size &&
                board[ni][nj] === 0 &&
                !searched.has(key)
              ) {
                moves.push({ row: ni, col: nj })
                searched.add(key)
              }
            }
          }
        }
      }
    }

    // 如果棋盘为空，返回中心位置
    if (moves.length === 0) {
      const center = Math.floor(this.size / 2)
      moves.push({ row: center, col: center })
    }

    // 限制搜索范围以提高性能（最多考虑20个位置）
    if (moves.length > 20) {
      // 根据位置价值排序，选择最好的20个
      moves.sort((a, b) => {
        const scoreA = this.getMoveScore(board, a.row, a.col)
        const scoreB = this.getMoveScore(board, b.row, b.col)
        return scoreB - scoreA
      })
      return moves.slice(0, 20)
    }

    return moves
  }

  // 评估单个位置的得分（用于排序）
  getMoveScore(board, row, col) {
    let score = 0
    
    // 中心位置更有价值
    const center = Math.floor(this.size / 2)
    const distFromCenter = Math.abs(row - center) + Math.abs(col - center)
    score += (this.size - distFromCenter)
    
    return score
  }

  // 检查是否有玩家获胜
  checkWinner(board) {
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] !== 0) {
          const winner = this.checkWinnerAt(board, i, j)
          if (winner) {
            return winner
          }
        }
      }
    }
    return null
  }

  // 检查指定位置是否形成五连
  checkWinnerAt(board, row, col) {
    const player = board[row][col]
    if (player === 0) return null

    const directions = [
      [[0, 1], [0, -1]],   // 水平
      [[1, 0], [-1, 0]],   // 垂直
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ]

    for (let dir of directions) {
      let count = 1

      for (let d of dir) {
        let r = row + d[0]
        let c = col + d[1]
        while (
          r >= 0 && r < this.size &&
          c >= 0 && c < this.size &&
          board[r][c] === player
        ) {
          count++
          r += d[0]
          c += d[1]
        }
      }

      if (count >= 5) {
        return player
      }
    }

    return null
  }

  // 检查棋盘是否为空
  isBoardEmpty() {
    for (let row of this.board) {
      for (let cell of row) {
        if (cell !== 0) {
          return false
        }
      }
    }
    return true
  }

  // 检查棋盘是否已满
  isBoardFull(board) {
    for (let row of board) {
      for (let cell of row) {
        if (cell === 0) {
          return false
        }
      }
    }
    return true
  }
}

module.exports = AI
