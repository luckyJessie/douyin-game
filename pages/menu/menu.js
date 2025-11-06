Page({
  data: {
    gameMode: 'ai', // 'ai' 或 'pvp'
    difficulty: 'medium', // 'easy', 'medium', 'hard'
    aiFirst: false // false: 玩家先手, true: AI先手
  },

  onLoad() {
    // 可以读取之前保存的设置
    const savedMode = wx.getStorageSync('gameMode')
    const savedDifficulty = wx.getStorageSync('difficulty')
    if (savedMode) {
      this.setData({ gameMode: savedMode })
    }
    if (savedDifficulty) {
      this.setData({ difficulty: savedDifficulty })
    }
  },

  // 选择游戏模式
  selectGameMode(e) {
    const mode = e.currentTarget.dataset.mode
    this.setData({ gameMode: mode })
    wx.setStorageSync('gameMode', mode)
  },

  // 选择难度
  selectDifficulty(e) {
    const difficulty = e.currentTarget.dataset.difficulty
    this.setData({ difficulty })
    wx.setStorageSync('difficulty', difficulty)
  },

  // 选择先手
  selectFirstMove(e) {
    const first = e.currentTarget.dataset.first === 'true'
    this.setData({ aiFirst: first })
  },

  // 开始游戏
  startGame() {
    const { gameMode, difficulty, aiFirst } = this.data
    
    wx.navigateTo({
      url: `/pages/index/index?mode=${gameMode}&difficulty=${difficulty}&aiFirst=${aiFirst}`
    })
  }
})
