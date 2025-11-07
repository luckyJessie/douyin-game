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
      'easy': { start: 3, mid: 3, end: 4 },
      'medium': { start: 3, mid: 4, end: 5 },
      'hard': { start: 4, mid: 5, end: 6 }
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

    // 2. 检查是否有必杀或必防的位置（优化：只检查关键位置）
    const forcedMove = this.findForcedMove()
    if (forcedMove) {
      return forcedMove
    }

    const moves = this.getValidMovesNearPieces(this.board)
    if (moves.length === 0) {
      return null
    }

    // 3. 终局使用更深的搜索或全搜索（优化：只在真正终局时使用）
    if (this.isEndgame && this.moveCount > this.size * this.size * 0.75) {
      return this.fullSearch()
    }

    // 4. 使用Alpha-Beta剪枝的Minimax算法
    // 优化：使用更高效的快速评估，减少重复计算
    const scoredMoves = moves.map(move => {
      // 使用快速评估（不创建新棋盘，提升性能）
      const attackScore = this.quickEvaluate(this.board, move.row, move.col, this.aiPlayer)
      
      // 防守评分（优化：只在必要时计算）
      let defenseScore = 0
      // 快速检查：只检查关键威胁，不创建完整棋盘
      const humanThreat = this.quickCheckThreat(this.board, move.row, move.col, this.humanPlayer)
      
      if (humanThreat.liveFour) {
        defenseScore += 10000
      } else if (humanThreat.rushFour) {
        defenseScore += 5000
      } else if (humanThreat.doubleLiveThree) {
        defenseScore += 2000
      } else if (humanThreat.liveThree) {
        defenseScore += 500
      }
      
      return { move, score: attackScore + defenseScore }
    })
    
    // 排序，优先搜索高价值位置
    scoredMoves.sort((a, b) => b.score - a.score)

    // 限制搜索的前几个最佳位置（根据难度调整）
    const searchLimit = Math.min(scoredMoves.length, {
      'easy': 8,
      'medium': 12,
      'hard': 16
    }[this.difficulty] || 12)

    let bestMove = null
    let bestValue = -Infinity

    for (let i = 0; i < searchLimit; i++) {
      const { move } = scoredMoves[i]
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

    // 检查是否需要防守（阻止玩家获胜）- 增强版
    let urgentDefense = null
    let highThreatDefense = null
    
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (this.board[i][j] === 0) {
          // 检查玩家在此位置是否能直接获胜（必须防守）
          this.board[i][j] = this.humanPlayer
          if (this.checkWinnerAt(this.board, i, j) === this.humanPlayer) {
            this.board[i][j] = 0
            return { row: i, col: j } // 必须防守
          }
          
          // 检查玩家是否能形成活四或冲四（高威胁，优先防守）
          const liveFour = this.countLiveFour(this.board, i, j, this.humanPlayer)
          const rushFour = this.countRushFour(this.board, i, j, this.humanPlayer)
          
          if (liveFour > 0 || rushFour > 0) {
            this.board[i][j] = 0
            if (!urgentDefense) {
              urgentDefense = { row: i, col: j }
            }
          }
          
          // 检查玩家是否能形成活三（中等威胁）
          const liveThree = this.countLiveThree(this.board, i, j, this.humanPlayer)
          if (liveThree >= 2 && !highThreatDefense) {
            this.board[i][j] = 0
            highThreatDefense = { row: i, col: j }
          }
          
          this.board[i][j] = 0
        }
      }
    }
    
    // 优先返回高威胁防守位置
    if (urgentDefense) {
      return urgentDefense
    }
    
    if (highThreatDefense) {
      return highThreatDefense
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
   * 快速检查威胁（优化版，不创建新棋盘）
   */
  quickCheckThreat(board, row, col, player) {
    const result = {
      liveFour: false,
      rushFour: false,
      doubleLiveThree: false,
      liveThree: false
    }
    
    // 临时设置棋子（不创建新数组）
    const originalValue = board[row][col]
    board[row][col] = player
    
    // 快速检查活四和冲四
    const liveFour = this.countLiveFour(board, row, col, player)
    const rushFour = this.countRushFour(board, row, col, player)
    const liveThree = this.countLiveThree(board, row, col, player)
    
    result.liveFour = liveFour > 0
    result.rushFour = rushFour > 0
    result.doubleLiveThree = liveThree >= 2
    result.liveThree = liveThree > 0
    
    // 恢复原值
    board[row][col] = originalValue
    
    return result
  }

  /**
   * 快速评估一个位置的得分（用于排序，优化版）
   */
  quickEvaluate(board, row, col, player) {
    let score = 0
    
    // 位置权重
    score += this.positionWeights[row][col]
    
    // 检查周围棋子情况（优化：减少循环次数）
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]
    const opponent = player === this.aiPlayer ? this.humanPlayer : this.aiPlayer
    
    for (let [dr, dc] of directions) {
      let aiCount = 0
      let humanCount = 0
      
      // 检查两个方向（优化：合并计算）
      for (let dir of [[dr, dc], [-dr, -dc]]) {
        let r = row + dir[0]
        let c = col + dir[1]
        let count = 0
        
        // AI连子
        while (
          r >= 0 && r < this.size &&
          c >= 0 && c < this.size &&
          board[r][c] === player &&
          count < 3
        ) {
          aiCount++
          r += dir[0]
          c += dir[1]
          count++
        }
        
        // 人类连子（重置位置）
        r = row + dir[0]
        c = col + dir[1]
        count = 0
        while (
          r >= 0 && r < this.size &&
          c >= 0 && c < this.size &&
          board[r][c] === opponent &&
          count < 3
        ) {
          humanCount++
          r += dir[0]
          c += dir[1]
          count++
        }
      }
      
      // 根据连子数给分（优化评分）
      if (aiCount >= 3) score += 200
      else if (aiCount === 2) score += 30
      else if (aiCount === 1) score += 5
      
      if (humanCount >= 3) score -= 150  // 防守
      else if (humanCount === 2) score -= 20
      else if (humanCount === 1) score -= 3
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
    
    // 对移动进行排序以提高剪枝效率（简化版，减少计算）
    const scoredMoves = moves.map(move => ({
      move,
      score: isMaximizing 
        ? this.quickEvaluate(board, move.row, move.col, this.aiPlayer)
        : -this.quickEvaluate(board, move.row, move.col, this.humanPlayer)
    }))
    scoredMoves.sort((a, b) => b.score - a.score)
    
    // 限制搜索的移动数量（优化：根据深度动态调整）
    const maxMovesToSearch = depth > 2 
      ? Math.min(scoredMoves.length, {
          'easy': 8,
          'medium': 10,
          'hard': 12
        }[this.difficulty] || 10)
      : Math.min(scoredMoves.length, 15)  // 浅层搜索更多位置
    const movesToSearch = scoredMoves.slice(0, maxMovesToSearch)

    if (isMaximizing) {
      // AI回合，选择最大值
      let maxValue = -Infinity
      for (let { move } of movesToSearch) {
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
      for (let { move } of movesToSearch) {
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

  // 增强的评估函数（优化版：减少重复计算）
  evaluate(board) {
    let score = 0

    // 1. 基础连子评估（优化：使用缓存或简化计算）
    score += this.evaluateLines(board, this.aiPlayer) * 20
    score -= this.evaluateLines(board, this.humanPlayer) * 25

    // 2. 威胁评估（能形成五连的位置）- 优化：只在必要时计算
    const aiThreats = this.evaluateThreats(board, this.aiPlayer)
    const humanThreats = this.evaluateThreats(board, this.humanPlayer)
    score += aiThreats * 200
    score -= humanThreats * 300

    // 3. 复杂棋形评估（优化：只在有威胁时计算）
    if (humanThreats > 0 || aiThreats > 0) {
      score += this.evaluateComplexShapes(board, this.aiPlayer) * 40
      score -= this.evaluateComplexShapes(board, this.humanPlayer) * 60
    }

    // 4. 位置权重评估（简化）
    score += this.evaluatePositionValue(board, this.aiPlayer) * 0.8
    score -= this.evaluatePositionValue(board, this.humanPlayer) * 0.8

    // 5. 攻防平衡：如果玩家有威胁，大幅加强防守权重
    if (humanThreats > 0) {
      score -= humanThreats * 100
    }
    
    // 6. 检查玩家活三、冲四威胁（优化：只在有明显威胁时计算）
    if (humanThreats > 0) {
      const humanLiveThrees = this.countAllLiveThrees(board, this.humanPlayer)
      const humanRushFours = this.countAllRushFours(board, this.humanPlayer)
      const humanLiveFours = this.countAllLiveFours(board, this.humanPlayer)
      
      if (humanLiveFours > 0) {
        score -= 5000
      } else if (humanRushFours > 0) {
        score -= 2000
      } else if (humanLiveThrees >= 2) {
        score -= 1000
      } else if (humanLiveThrees > 0) {
        score -= 300
      }
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
   * 统计所有位置的活三数量
   */
  countAllLiveThrees(board, player) {
    let totalCount = 0
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] === 0) {
          const count = this.countLiveThree(board, i, j, player)
          if (count > 0) {
            totalCount += count
          }
        }
      }
    }
    return totalCount
  }

  /**
   * 统计所有位置的冲四数量
   */
  countAllRushFours(board, player) {
    let totalCount = 0
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] === 0) {
          const count = this.countRushFour(board, i, j, player)
          if (count > 0) {
            totalCount += count
          }
        }
      }
    }
    return totalCount
  }

  /**
   * 统计所有位置的活四数量
   */
  countAllLiveFours(board, player) {
    let totalCount = 0
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] === 0) {
          const count = this.countLiveFour(board, i, j, player)
          if (count > 0) {
            totalCount += count
          }
        }
      }
    }
    return totalCount
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

  // 获取有效落子位置（仅在有棋子附近的位置，优化版）
  getValidMovesNearPieces(board) {
    const moves = []
    const searched = new Set()

    // 优化：只检查有棋子的区域，减少遍历
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < this.size; j++) {
        if (board[i][j] !== 0) {
          // 查找周围2格内的空位（恢复2格范围以提升AI水平）
          for (let di = -2; di <= 2; di++) {
            for (let dj = -2; dj <= 2; dj++) {
              if (di === 0 && dj === 0) continue
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
      return moves
    }

    // 限制搜索范围以提高性能（根据难度和局面复杂度调整）
    const maxMoves = {
      'easy': 18,
      'medium': 22,
      'hard': 28
    }[this.difficulty] || 22
    
    if (moves.length > maxMoves) {
      // 根据位置价值排序，选择最好的位置（优化：使用更快的排序）
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
