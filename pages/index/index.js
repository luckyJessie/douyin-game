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
    coordinates: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']
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
    
    this.setData({
      board,
      boardSize,
      currentPlayer,
      gameStatus,
      gameOver: false,
      moveHistory: []
    })

    // 如果AI先手，自动下第一步
    if (!skipAIFirstMove && this.data.gameMode === 'ai' && this.data.aiFirst) {
      setTimeout(() => {
        this.aiMove()
      }, 500)
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

    wx.showLoading({
      title: 'AI思考中...',
      mask: true
    })

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

      wx.hideLoading()
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
    }
  },

  // 返回菜单
  goBack() {
    wx.showModal({
      title: '返回菜单',
      content: '确定要返回菜单吗？当前游戏进度将丢失。',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  }
})
