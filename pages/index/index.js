const AI = require('../../utils/ai.js')

Page({
  data: {
    board: [],
    boardSize: 0,
    currentPlayer: 1, // 1: 玩家1(黑), 2: 玩家2/AI(白)
    gameStatus: '玩家1回合',
    gameOver: false,
    moveHistory: [],
    gameMode: 'ai', // 'ai' 或 'pvp'
    difficulty: 'medium', // 'easy', 'medium', 'hard'
    aiFirst: false,
    timeLeft: 5, // 剩余时间（秒）
    timeProgress: 100, // 时间进度百分比
    totalTime: 5, // 总时间（秒）
    timerInterval: null // 定时器
  },

  onLoad(options) {
    // 从菜单页面获取参数
    const mode = options.mode || 'ai'
    const difficulty = options.difficulty || 'medium'
    const aiFirst = options.aiFirst === 'true'
    
    this.setData({
      gameMode: mode,
      difficulty,
      aiFirst
    })
    
    this.initGame(aiFirst)
  },

  onUnload() {
    // 清理定时器
    this.clearTimer()
  },

  // 清理定时器
  clearTimer() {
    if (this.data.timerInterval) {
      clearInterval(this.data.timerInterval)
      this.setData({ timerInterval: null })
    }
  },

  // 启动倒计时
  startTimer() {
    // 先清理旧的定时器
    this.clearTimer()
    
    // 重置时间
    const totalTime = 5
    this.setData({ 
      timeLeft: totalTime,
      timeProgress: 100,
      totalTime: totalTime
    })

    // 在玩家回合时启动倒计时（双人对战或人机对战）
    if (!this.data.gameOver && this.data.currentPlayer === 1) {
      const that = this
      const interval = setInterval(() => {
        // 检查游戏是否已结束
        if (that.data.gameOver) {
          that.clearTimer()
          return
        }
        
        // 检查是否还是玩家回合（防止在AI思考时继续倒计时）
        if (that.data.currentPlayer !== 1) {
          that.clearTimer()
          return
        }
        
        let timeLeft = that.data.timeLeft - 1
        
        if (timeLeft <= 0) {
          // 超时，自动落子
          that.clearTimer()
          that.autoMove()
          return
        }

        const timeProgress = (timeLeft / that.data.totalTime) * 100
        
        that.setData({
          timeLeft,
          timeProgress
        })
      }, 1000)

      this.setData({ timerInterval: interval })
    }
  },

  // 超时自动落子
  autoMove() {
    if (this.data.gameOver || this.data.currentPlayer !== 1) {
      return
    }

    // 使用简单的AI选择最佳位置
    const board = this.data.board.map(r => [...r])
    const move = this.getAutoMove(board, this.data.currentPlayer)

    if (move) {
      wx.showToast({
        title: '超时自动落子',
        icon: 'none',
        duration: 1500
      })
      
      setTimeout(() => {
        this.makeMove(move.row, move.col, this.data.currentPlayer)
      }, 300)
    } else {
      // 如果找不到好的位置，随机选择
      const moves = this.getValidMoves(board)
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)]
        wx.showToast({
          title: '超时随机落子',
          icon: 'none',
          duration: 1500
        })
        setTimeout(() => {
          this.makeMove(randomMove.row, randomMove.col, this.data.currentPlayer)
        }, 300)
      }
    }
  },

  // 获取自动落子位置（简单AI逻辑）
  getAutoMove(board, player) {
    const size = board.length
    let bestMove = null
    let bestScore = -Infinity

    // 获取所有有效位置
    const moves = this.getValidMoves(board)

    for (let move of moves) {
      let score = 0
      const { row, col } = move

      // 检查是否能直接获胜
      board[row][col] = player
      if (this.checkWinner(board, row, col) === player) {
        board[row][col] = 0
        return move
      }

      // 检查是否需要防守（阻止对方获胜）
      const opponent = player === 1 ? 2 : 1
      board[row][col] = opponent
      if (this.checkWinner(board, row, col) === opponent) {
        board[row][col] = 0
        return move // 必须防守
      }
      board[row][col] = 0

      // 评估位置得分（简化版）
      score += this.evaluateMoveScore(board, row, col, player)
      
      // 中心位置加分
      const center = Math.floor(size / 2)
      const distFromCenter = Math.abs(row - center) + Math.abs(col - center)
      score += (size - distFromCenter) * 0.5

      if (score > bestScore) {
        bestScore = score
        bestMove = move
      }
    }

    return bestMove
  },

  // 评估位置得分（简化版）
  evaluateMoveScore(board, row, col, player) {
    let score = 0
    const directions = [
      [[0, 1], [0, -1]],   // 水平
      [[1, 0], [-1, 0]],   // 垂直
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ]

    for (let dir of directions) {
      let count = 1 // 模拟落子后的连子数

      for (let d of dir) {
        let r = row + d[0]
        let c = col + d[1]
        while (
          r >= 0 && r < board.length &&
          c >= 0 && c < board[0].length &&
          board[r][c] === player
        ) {
          count++
          r += d[0]
          c += d[1]
        }
      }

      // 根据连子数给分
      if (count >= 4) score += 100
      else if (count === 3) score += 20
      else if (count === 2) score += 5
    }

    return score
  },

  // 获取所有有效落子位置
  getValidMoves(board) {
    const moves = []
    for (let i = 0; i < board.length; i++) {
      for (let j = 0; j < board[i].length; j++) {
        if (board[i][j] === 0) {
          moves.push({ row: i, col: j })
        }
      }
    }
    return moves
  },

  // 初始化游戏
  initGame(skipAIFirstMove = false) {
    const size = 15
    const board = []
    for (let i = 0; i < size; i++) {
      board[i] = []
      for (let j = 0; j < size; j++) {
        board[i][j] = 0
      }
    }
    
    // 计算棋盘显示尺寸（根据屏幕宽度）
    const systemInfo = wx.getSystemInfoSync()
    const boardSize = Math.min(systemInfo.windowWidth - 100, 600)
    
    const currentPlayer = 1
    const gameStatus = this.data.gameMode === 'pvp' ? '玩家1回合' : 
                      (this.data.aiFirst ? '电脑思考中...' : '玩家回合')
    
    // 清理定时器
    this.clearTimer()
    
    this.setData({
      board,
      boardSize,
      currentPlayer,
      gameStatus,
      gameOver: false,
      moveHistory: [],
      timeLeft: 5,
      timeProgress: 100,
      totalTime: 5
    })

    // 如果AI先手，自动下第一步
    if (!skipAIFirstMove && this.data.gameMode === 'ai' && this.data.aiFirst) {
      setTimeout(() => {
        this.aiMove()
      }, 500)
    }
    
    // 如果是玩家回合，启动倒计时
    if (this.data.currentPlayer === 1) {
      this.startTimer()
    }
  },

  // 处理点击棋盘
  onCellTap(e) {
    if (this.data.gameOver) {
      return
    }

    // 双人对战：两个玩家都可以下
    // 人机对战：只有玩家1可以下（currentPlayer === 1）
    if (this.data.gameMode === 'ai' && this.data.currentPlayer !== 1) {
      return
    }

    const { row, col } = e.currentTarget.dataset
    if (this.data.board[row][col] !== 0) {
      wx.showToast({
        title: '该位置已有棋子',
        icon: 'none',
        duration: 1000
      })
      return
    }

    const player = this.data.currentPlayer
    this.makeMove(row, col, player)
  },

  // 执行落子
  makeMove(row, col, player) {
    // 清理定时器
    this.clearTimer()
    
    const board = this.data.board.map(r => [...r])
    board[row][col] = player
    
    const moveHistory = [...this.data.moveHistory, { row, col, player }]
    
    // 检查是否获胜
    const winner = this.checkWinner(board, row, col)
    
    if (winner) {
      let statusText = ''
      if (this.data.gameMode === 'pvp') {
        statusText = winner === 1 ? '玩家1获胜！' : '玩家2获胜！'
      } else {
        statusText = winner === 1 ? '玩家获胜！' : '电脑获胜！'
      }
      
      this.setData({
        board,
        moveHistory,
        gameOver: true,
        gameStatus: statusText,
        currentPlayer: 0
      })
      
      // 显示获胜提示
      wx.showModal({
        title: '游戏结束',
        content: statusText,
        showCancel: false
      })
      
      return
    }

    // 检查是否平局（棋盘满了）
    if (this.isBoardFull(board)) {
      this.setData({
        board,
        moveHistory,
        gameOver: true,
        gameStatus: '平局！',
        currentPlayer: 0
      })
      
      wx.showModal({
        title: '游戏结束',
        content: '平局！',
        showCancel: false
      })
      
      return
    }

    // 切换玩家
    const nextPlayer = player === 1 ? 2 : 1
    let nextStatus = ''
    
    if (this.data.gameMode === 'pvp') {
      nextStatus = nextPlayer === 1 ? '玩家1回合' : '玩家2回合'
    } else {
      nextStatus = nextPlayer === 1 ? '玩家回合' : '电脑思考中...'
    }
    
    this.setData({
      board,
      moveHistory,
      currentPlayer: nextPlayer,
      gameStatus: nextStatus
    })

    // 如果是玩家回合，启动倒计时
    if (this.data.currentPlayer === 1 && !this.data.gameOver) {
      this.startTimer()
    }

    // 如果是AI回合（人机对战且轮到AI），延迟后执行AI落子
    if (this.data.gameMode === 'ai' && nextPlayer === 2 && !this.data.gameOver) {
      setTimeout(() => {
        this.aiMove()
      }, 300)
    }
  },

  // AI落子
  aiMove() {
    if (this.data.gameOver || this.data.gameMode !== 'ai') {
      return
    }

    // 异步执行AI思考，不阻塞界面
    setTimeout(() => {
      const board = this.data.board.map(r => [...r])
      // 传入难度参数
      const ai = new AI(board, 2, 1, this.data.difficulty)
      const move = ai.getBestMove()

      if (move) {
        this.makeMove(move.row, move.col, 2)
      } else {
        wx.showToast({
          title: '无法找到走法',
          icon: 'none'
        })
      }
    }, 100)
  },

  // 检查是否获胜
  checkWinner(board, row, col) {
    const player = board[row][col]
    if (player === 0) return null

    // 检查四个方向：水平、垂直、主对角线、副对角线
    const directions = [
      [[0, 1], [0, -1]],   // 水平
      [[1, 0], [-1, 0]],   // 垂直
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ]

    for (let dir of directions) {
      let count = 1 // 包含当前棋子

      // 检查两个方向
      for (let d of dir) {
        let r = row + d[0]
        let c = col + d[1]
        while (
          r >= 0 && r < board.length &&
          c >= 0 && c < board[0].length &&
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
  },

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
  },

  // 重新开始游戏
  restartGame() {
    wx.showModal({
      title: '重新开始',
      content: '确定要重新开始游戏吗？',
      success: (res) => {
        if (res.confirm) {
          this.initGame(this.data.aiFirst)
        }
      }
    })
  },

  // 悔棋
  undoMove() {
    if (this.data.moveHistory.length < 1 || this.data.gameOver) {
      wx.showToast({
        title: '无法悔棋',
        icon: 'none'
      })
      return
    }

    // 清理定时器
    this.clearTimer()

    // 双人对战：撤销一步
    // 人机对战：撤销两步（玩家和AI各一步）
    const steps = this.data.gameMode === 'pvp' ? 1 : 2
    
    const board = this.data.board.map(r => [...r])
    const moveHistory = [...this.data.moveHistory]
    
    if (moveHistory.length >= steps) {
      // 移除最后N步
      for (let i = 0; i < steps; i++) {
        const move = moveHistory.pop()
        board[move.row][move.col] = 0
      }
      
      const nextPlayer = steps === 1 ? (this.data.currentPlayer === 1 ? 2 : 1) : 1
      const nextStatus = this.data.gameMode === 'pvp' 
        ? (nextPlayer === 1 ? '玩家1回合' : '玩家2回合')
        : '玩家回合'
      
      this.setData({
        board,
        moveHistory,
        currentPlayer: nextPlayer,
        gameStatus: nextStatus
      })

      // 如果是玩家回合，重新启动倒计时
      if (this.data.currentPlayer === 1) {
        this.startTimer()
      }
    } else if (moveHistory.length === 1) {
      // 只有一步，移除它
      const move = moveHistory.pop()
      board[move.row][move.col] = 0
      
      this.setData({
        board,
        moveHistory,
        currentPlayer: 1,
        gameStatus: this.data.gameMode === 'pvp' ? '玩家1回合' : '玩家回合'
      })

      // 如果是玩家回合，重新启动倒计时
      if (this.data.currentPlayer === 1) {
        this.startTimer()
      }
    }
  },

  // 返回菜单
  goBack() {
    wx.showModal({
      title: '返回菜单',
      content: '确定要返回菜单吗？当前游戏进度将丢失。',
      success: (res) => {
        if (res.confirm) {
          this.clearTimer()
          wx.navigateBack()
        }
      }
    })
  }
})
