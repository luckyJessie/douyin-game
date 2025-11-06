const AI = require('../../utils/ai.js')

Page({
  data: {
    board: [],
    boardSize: 0,
    currentPlayer: 1, // 1: 玩家(黑), 2: AI(白)
    gameStatus: '玩家回合',
    gameOver: false,
    moveHistory: []
  },

  onLoad() {
    this.initGame()
  },

  // 初始化游戏
  initGame() {
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
    const boardSize = Math.min(systemInfo.windowWidth - 80, 650)
    
    this.setData({
      board,
      boardSize,
      currentPlayer: 1,
      gameStatus: '玩家回合',
      gameOver: false,
      moveHistory: []
    })
  },

  // 处理点击棋盘
  onCellTap(e) {
    if (this.data.gameOver || this.data.currentPlayer !== 1) {
      return
    }

    const { row, col } = e.currentTarget.dataset
    if (this.data.board[row][col] !== 0) {
      return
    }

    this.makeMove(row, col, 1)
  },

  // 执行落子
  makeMove(row, col, player) {
    const board = this.data.board.map(r => [...r])
    board[row][col] = player
    
    const moveHistory = [...this.data.moveHistory, { row, col, player }]
    
    // 检查是否获胜
    const winner = this.checkWinner(board, row, col)
    
    if (winner) {
      this.setData({
        board,
        moveHistory,
        gameOver: true,
        gameStatus: winner === 1 ? '玩家获胜！' : '电脑获胜！',
        currentPlayer: 0
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
      return
    }

    // 切换玩家
    const nextPlayer = player === 1 ? 2 : 1
    
    this.setData({
      board,
      moveHistory,
      currentPlayer: nextPlayer,
      gameStatus: nextPlayer === 1 ? '玩家回合' : '电脑思考中...'
    })

    // 如果是AI回合，延迟后执行AI落子
    if (nextPlayer === 2 && !this.data.gameOver) {
      setTimeout(() => {
        this.aiMove()
      }, 300)
    }
  },

  // AI落子
  aiMove() {
    if (this.data.gameOver) {
      return
    }

    wx.showLoading({
      title: 'AI思考中...',
      mask: true
    })

    setTimeout(() => {
      const board = this.data.board.map(r => [...r])
      const ai = new AI(board, 2, 1)
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
    this.initGame()
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

    // 回溯两步（玩家和AI各一步）
    const board = this.data.board.map(r => [...r])
    const moveHistory = [...this.data.moveHistory]
    
    if (moveHistory.length >= 2) {
      // 移除最后两步
      const move1 = moveHistory.pop()
      const move2 = moveHistory.pop()
      board[move1.row][move1.col] = 0
      board[move2.row][move2.col] = 0
      
      this.setData({
        board,
        moveHistory,
        currentPlayer: 1,
        gameStatus: '玩家回合'
      })
    } else if (moveHistory.length === 1) {
      // 只有一步，移除它
      const move = moveHistory.pop()
      board[move.row][move.col] = 0
      
      this.setData({
        board,
        moveHistory,
        currentPlayer: 1,
        gameStatus: '玩家回合'
      })
    }
  }
})
