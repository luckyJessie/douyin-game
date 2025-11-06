/**
 * 五子棋AI - 增强版
 * 使用Minimax算法 + Alpha-Beta剪枝
 * 包含：自适应搜索深度、增强评估函数、开局库、终局搜索
 */
const OpeningBook = require('./openingBook.js')

class AI {
  constructor(board, aiPlayer, humanPlayer, difficulty = 'medium') {
    this.board = board.map(r => [...r])
    this.aiPlayer = aiPlayer // AI玩家（通常为2）
    this.humanPlayer = humanPlayer // 人类玩家（通常为1）
    this.size = board.length
    this.openingBook = new OpeningBook()
    this.difficulty = difficulty // 'easy', 'medium', 'hard'
    
    // 计算当前局面信息
    this.moveCount = this.countMoves(board)
    this.isEndgame = this.moveCount > this.size * this.size * 0.6 // 60%以上棋子已下
    
    // 根据难度和阶段设置搜索深度
    this.setDepthByDifficulty()
    
    // 位置权重表（角、边、中心的权重不同）
    this.initPositionWeights()
  }

  /**
   * 根据难度设置搜索深度
   */
  setDepthByDifficulty() {
    const depthConfig = {
      'easy': { start: 2, mid: 2, end: 3 },
      'medium': { start: 3, mid: 4, end: 5 },
      'hard': { start: 3, mid: 5, end: 6 }
    }
    const baseDepth = depthConfig[this.difficulty] || depthConfig.medium

    if (this.isEndgame) {
      this.depth = baseDepth.end // 终局加深搜索
    } else if (this.moveCount < 10) {
      this.depth = baseDepth.start // 开局较浅
    } else {
      this.depth = baseDepth.mid // 中局
    }
  }

  /**
   * 初始化位置权重表
   */
  initPositionWeights() {
    this.positionWeights = []
    const center = Math.floor(this.size / 2)
    
    for (let i = 0; i < this.size; i++) {
      this.positionWeights[i] = []
      for (let j = 0; j < this.size; j++) {
        // 中心权重最高，边次之，角最低
        const distFromCenter = Math.abs(i - center) + Math.abs(j - center)
        const distFromEdge = Math.min(i, this.size - 1 - i, j, this.size - 1 - j)
        
        let weight = 10
        
        // 中心区域权重高
        if (distFromCenter <= 3) {
          weight += 5
        }
        
        // 边角权重低
        if (distFromEdge === 0) {
          weight -= 3
        }
        
        this.positionWeights[i][j] = weight
      }
    }
  }

  /**
   * 统计棋盘上的棋子数
   */
  countMoves(board) {
    let count = 0
    for (let row of board) {
      for (let cell of row) {
        if (cell !== 0) {
          count++
        }
      }
    }
    return count
  }

  // 获取最佳落子位置
  getBestMove() {
    // 1. 开局库查询
    const openingMove = this.openingBook.getMove(this.board, this.moveCount)
    if (openingMove) {
      return openingMove
    }

    // 2. 检查是否有必杀或必防的位置
    const forcedMove = this.findForcedMove()
    if (forcedMove) {
      return forcedMove
    }

    const moves = this.getValidMovesNearPieces(this.board)
    if (moves.length === 0) {
      return null
    }

    // 3. 终局使用更深的搜索或全搜索
    if (this.isEndgame && this.moveCount > this.size * this.size * 0.7) {
      // 最后阶段使用全搜索
      return this.fullSearch()
    }

    let bestMove = null
    let bestValue = -Infinity

    // 4. 使用Alpha-Beta剪枝的Minimax算法
    // 对候选位置进行排序，优先搜索高价值位置
    const scoredMoves = moves.map(move => ({
      move,
      score: this.quickEvaluate(this.board, move.row, move.col, this.aiPlayer)
    }))
    scoredMoves.sort((a, b) => b.score - a.score)

    for (let { move } of scoredMoves) {
      this.board[move.row][move.col] = this.aiPlayer
      
      const value = this.minimax(this.board, this.depth - 1, false, -Infinity, Infinity)
      
      this.board[move.row][move.col] = 0

      if (value > bestValue) {
        bestValue = value
        bestMove = move
      }

      // Alpha-Beta剪枝优化：如果已经找到极好的走法，可以提前退出
      if (bestValue > 5000) {
        break
      }
    }

    return bestMove
  }

  /**
   * 查找必杀或必防的位置
   */
  findForcedMove() {
    // 检查AI是否能直接获胜
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (this.board[i][j] === 0) {
          this.board[i][j] = this.aiPlayer
          if (this.checkWinnerAt(this.board, i, j) === this.aiPlayer) {
            this.board[i][j] = 0
            return { row: i, col: j }
          }
          this.board[i][j] = 0
        }
      }
    }

    // 检查是否需要防守（阻止玩家获胜）
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (this.board[i][j] === 0) {
          this.board[i][j] = this.humanPlayer
          if (this.checkWinnerAt(this.board, i, j) === this.humanPlayer) {
            this.board[i][j] = 0
            return { row: i, col: j } // 必须防守
          }
          this.board[i][j] = 0
        }
      }
    }

    return null
  }

  /**
   * 终局全搜索（最后几步）
   */
  fullSearch() {
    const moves = this.getValidMoves()
    let bestMove = null
    let bestValue = -Infinity

    for (let move of moves) {
      this.board[move.row][move.col] = this.aiPlayer
      
      // 如果能直接获胜
      if (this.checkWinnerAt(this.board, move.row, move.col) === this.aiPlayer) {
        this.board[move.row][move.col] = 0
        return move
      }

      // 尝试所有对手的应对
      let minValue = Infinity
      const opponentMoves = this.getValidMoves()
      
      for (let oppMove of opponentMoves) {
        this.board[oppMove.row][oppMove.col] = this.humanPlayer
        
        if (this.checkWinnerAt(this.board, oppMove.row, oppMove.col) === this.humanPlayer) {
          // 对手能获胜，这个走法不好
          this.board[oppMove.row][oppMove.col] = 0
          minValue = -Infinity
          break
        }
        
        // 继续搜索
        const value = this.minimax(this.board, 2, true, -Infinity, Infinity)
        minValue = Math.min(minValue, value)
        
        this.board[oppMove.row][oppMove.col] = 0
      }
      
      this.board[move.row][move.col] = 0
      
      if (minValue > bestValue) {
        bestValue = minValue
        bestMove = move
      }
    }

    return bestMove
  }

  /**
   * 快速评估一个位置的得分（用于排序）
   */
  quickEvaluate(board, row, col) {
    let score = 0
    
    // 位置权重
    score += this.positionWeights[row][col]
    
    // 检查周围棋子情况
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]
    for (let [dr, dc] of directions) {
      let aiCount = 0
      let humanCount = 0
      
      // 检查两个方向
      for (let dir of [[dr, dc], [-dr, -dc]]) {
        let r = row + dir[0]
        let c = col + dir[1]
        let count = 1
        
        while (
          r >= 0 && r < this.size &&
          c >= 0 && c < this.size &&
          board[r][c] === this.aiPlayer &&
          count < 4
        ) {
          aiCount++
          r += dir[0]
          c += dir[1]
          count++
        }
      }
      
      if (aiCount >= 3) score += 100
      else if (aiCount === 2) score += 10
    }
    
    return score
  }

  // Minimax算法（带Alpha-Beta剪枝）
  minimax(board, depth, isMaximizing, alpha, beta) {
    // 检查游戏是否结束
    const winner = this.checkWinner(board)
    if (winner === this.aiPlayer) {
      return 100000 + depth * 100
    }
    if (winner === this.humanPlayer) {
      return -100000 - depth * 100
    }

    // 达到最大深度或棋盘已满，使用评估函数
    if (depth === 0 || this.isBoardFull(board)) {
      return this.evaluate(board)
    }

    const moves = this.getValidMovesNearPieces(board)
    
    // 对移动进行排序以提高剪枝效率
    const scoredMoves = moves.map(move => ({
      move,
      score: isMaximizing 
        ? this.quickEvaluate(board, move.row, move.col)
        : -this.quickEvaluate(board, move.row, move.col)
    }))
    scoredMoves.sort((a, b) => b.score - a.score)

    if (isMaximizing) {
      // AI回合，选择最大值
      let maxValue = -Infinity
      for (let { move } of scoredMoves) {
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
      for (let { move } of scoredMoves) {
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

  // 增强的评估函数
  evaluate(board) {
    let score = 0

    // 1. 基础连子评估
    score += this.evaluateLines(board, this.aiPlayer) * 20
    score -= this.evaluateLines(board, this.humanPlayer) * 20

    // 2. 威胁评估（能形成五连的位置）
    score += this.evaluateThreats(board, this.aiPlayer) * 200
    score -= this.evaluateThreats(board, this.humanPlayer) * 200

    // 3. 复杂棋形评估（双三、双四等）
    score += this.evaluateComplexShapes(board, this.aiPlayer) * 50
    score -= this.evaluateComplexShapes(board, this.humanPlayer) * 50

    // 4. 位置权重评估
    score += this.evaluatePositionValue(board, this.aiPlayer)
    score -= this.evaluatePositionValue(board, this.humanPlayer)

    // 5. 攻防平衡：如果玩家有威胁，加强防守权重
    const humanThreats = this.evaluateThreats(board, this.humanPlayer)
    if (humanThreats > 0) {
      score -= humanThreats * 50 // 防守权重
    }

    return score
  }

  /**
   * 评估复杂棋形（双三、双四等）
   */
  evaluateComplexShapes(board, player) {
    let score = 0
    
    // 检查双活三、双冲四等情况
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] === 0) {
          // 模拟落子
          board[i][j] = player
          
          // 统计能形成的活三和冲四数量
          const liveThreeCount = this.countLiveThree(board, i, j, player)
          const rushFourCount = this.countRushFour(board, i, j, player)
          const liveFourCount = this.countLiveFour(board, i, j, player)
          
          // 双活三：威胁很大
          if (liveThreeCount >= 2) {
            score += 30
          }
          
          // 双冲四：必杀
          if (rushFourCount >= 2 || liveFourCount >= 1) {
            score += 50
          }
          
          board[i][j] = 0
        }
      }
    }
    
    return score
  }

  /**
   * 统计活三数量
   */
  countLiveThree(board, row, col, player) {
    let count = 0
    const directions = [
      [[0, 1], [0, -1]],   // 水平
      [[1, 0], [-1, 0]],   // 垂直
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ]

    for (let dir of directions) {
      let totalLength = 1
      let blocked = 0

      for (let d of dir) {
        let length = 0
        let r = row + d[0]
        let c = col + d[1]
        
        while (
          r >= 0 && r < this.size &&
          c >= 0 && c < this.size &&
          board[r][c] === player &&
          length < 3
        ) {
          length++
          r += d[0]
          c += d[1]
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

      // 活三：连续3子，两端都未阻挡
      if (totalLength === 3 && blocked === 0) {
        count++
      }
    }

    return count
  }

  /**
   * 统计冲四数量
   */
  countRushFour(board, row, col, player) {
    let count = 0
    const directions = [
      [[0, 1], [0, -1]],   // 水平
      [[1, 0], [-1, 0]],   // 垂直
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ]

    for (let dir of directions) {
      let totalLength = 1
      let blocked = 0

      for (let d of dir) {
        let length = 0
        let r = row + d[0]
        let c = col + d[1]
        
        while (
          r >= 0 && r < this.size &&
          c >= 0 && c < this.size &&
          board[r][c] === player &&
          length < 4
        ) {
          length++
          r += d[0]
          c += d[1]
        }
        
        if (
          r < 0 || r >= this.size ||
          c < 0 || c >= this.size ||
          board[r][c] !== 0
        ) {
          blocked++
        }
        
        totalLength += length
      }

      // 冲四：连续4子，一端被阻挡
      if (totalLength === 4 && blocked === 1) {
        count++
      }
    }

    return count
  }

  /**
   * 统计活四数量
   */
  countLiveFour(board, row, col, player) {
    let count = 0
    const directions = [
      [[0, 1], [0, -1]],   // 水平
      [[1, 0], [-1, 0]],   // 垂直
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ]

    for (let dir of directions) {
      let totalLength = 1
      let blocked = 0

      for (let d of dir) {
        let length = 0
        let r = row + d[0]
        let c = col + d[1]
        
        while (
          r >= 0 && r < this.size &&
          c >= 0 && c < this.size &&
          board[r][c] === player &&
          length < 4
        ) {
          length++
          r += d[0]
          c += d[1]
        }
        
        if (
          r < 0 || r >= this.size ||
          c < 0 || c >= this.size ||
          board[r][c] !== 0
        ) {
          blocked++
        }
        
        totalLength += length
      }

      // 活四：连续4子，两端都未阻挡
      if (totalLength === 4 && blocked === 0) {
        count++
      }
    }

    return count
  }

  /**
   * 评估位置价值
   */
  evaluatePositionValue(board, player) {
    let score = 0
    
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] === player) {
          score += this.positionWeights[i][j]
        }
      }
    }
    
    return score
  }

  // 评估连子情况（增强版）
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

  // 评估一条线上的连子得分（增强版）
  evaluateLine(board, row, col, directions, player) {
    let totalLength = 1
    let blocked = 0
    let hasSpace = false

    for (let dir of directions) {
      let length = 0
      let r = row + dir[0]
      let c = col + dir[1]
      
      while (
        r >= 0 && r < this.size &&
        c >= 0 && c < this.size &&
        board[r][c] === player &&
        length < 5
      ) {
        length++
        r += dir[0]
        c += dir[1]
      }
      
      // 检查是否有扩展空间
      if (
        r >= 0 && r < this.size &&
        c >= 0 && c < this.size &&
        board[r][c] === 0
      ) {
        hasSpace = true
      }
      
      // 检查是否被阻挡
      if (
        r < 0 || r >= this.size ||
        c < 0 || c >= this.size ||
        (board[r] && board[r][c] !== 0)
      ) {
        blocked++
      }
      
      totalLength += length
    }

    // 根据连子长度和阻挡情况给分（增强）
    if (totalLength >= 5) return 10000  // 五连
    if (totalLength === 4 && blocked === 0) return 500  // 活四
    if (totalLength === 4 && blocked === 1) return 200  // 冲四
    if (totalLength === 3 && blocked === 0 && hasSpace) return 50   // 活三
    if (totalLength === 3 && blocked === 1) return 15    // 眠三
    if (totalLength === 3 && blocked === 0) return 20    // 活三（无扩展空间）
    if (totalLength === 2 && blocked === 0) return 5     // 活二
    if (totalLength === 2 && blocked === 1) return 2     // 眠二
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
          if (this.checkWinnerAt(board, i, j) === player) {
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

    // 限制搜索范围以提高性能（终局时扩大搜索范围）
    const maxMoves = this.isEndgame ? 30 : 20
    if (moves.length > maxMoves) {
      // 根据位置价值排序，选择最好的位置
      moves.sort((a, b) => {
        const scoreA = this.getMoveScore(board, a.row, a.col)
        const scoreB = this.getMoveScore(board, b.row, b.col)
        return scoreB - scoreA
      })
      return moves.slice(0, maxMoves)
    }

    return moves
  }

  // 评估单个位置的得分（用于排序）
  getMoveScore(board, row, col) {
    let score = 0
    
    // 位置权重
    score += this.positionWeights[row][col]
    
    // 周围棋子密度
    let nearbyPieces = 0
    for (let di = -2; di <= 2; di++) {
      for (let dj = -2; dj <= 2; dj++) {
        const ni = row + di
        const nj = col + dj
        if (
          ni >= 0 && ni < this.size &&
          nj >= 0 && nj < this.size &&
          board[ni][nj] !== 0
        ) {
          nearbyPieces++
        }
      }
    }
    score += nearbyPieces * 2
    
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
