/**
 * 豆芽五子棋微信小程序页面
 * pages/gomoku/gomoku.js
 */

// 引入AI算法类
const GomokuAI = require('../../utils/gomoku-ai.js');

Page({
  data: {
    board: [], // 15x15的棋盘
    currentPlayer: 1, // 当前玩家，1为黑棋，2为白棋
    gameOver: false,
    winner: 0,
    ai: null,
    aiThinking: false
  },

  onLoad() {
    this.initGame();
  },

  /**
   * 初始化游戏
   */
  initGame() {
    // 初始化15x15的空棋盘
    const board = [];
    for (let i = 0; i < 15; i++) {
      board[i] = [];
      for (let j = 0; j < 15; j++) {
        board[i][j] = 0; // 0表示空，1表示黑棋，2表示白棋
      }
    }

    // 创建AI实例，设置搜索深度为4
    const ai = new GomokuAI(4);
    ai.setAIPlayer(2); // AI执白棋（后手）

    this.setData({
      board: board,
      currentPlayer: 1, // 人类执黑棋（先手）
      gameOver: false,
      winner: 0,
      ai: ai,
      aiThinking: false
    });
  },

  /**
   * 处理玩家点击棋盘
   */
  onCellTap(e) {
    if (this.data.gameOver || this.data.aiThinking) {
      return;
    }

    const { row, col } = e.currentTarget.dataset;
    const board = this.data.board;
    const currentPlayer = this.data.currentPlayer;

    // 检查位置是否已被占用
    if (board[row][col] !== 0) {
      wx.showToast({
        title: '该位置已有棋子',
        icon: 'none'
      });
      return;
    }

    // 玩家落子
    board[row][col] = currentPlayer;
    this.setData({ board: board });

    // 检查是否获胜
    const winner = this.checkWinner(board);
    if (winner !== 0) {
      this.endGame(winner);
      return;
    }

    // 切换到AI回合
    this.setData({ 
      currentPlayer: 2,
      aiThinking: true
    });

    // 延迟一下，让玩家看到自己的落子
    setTimeout(() => {
      this.aiMove();
    }, 300);
  },

  /**
   * AI落子
   */
  aiMove() {
    const ai = this.data.ai;
    const board = this.data.board;

    // 使用AI算法计算最佳落子位置
    const bestMove = ai.getBestMove(board);

    if (bestMove) {
      board[bestMove.row][bestMove.col] = 2; // AI执白棋
      this.setData({ board: board });

      // 检查是否获胜
      const winner = this.checkWinner(board);
      if (winner !== 0) {
        this.endGame(winner);
        return;
      }

      // 切换回玩家回合
      this.setData({ 
        currentPlayer: 1,
        aiThinking: false
      });
    }
  },

  /**
   * 检查是否有玩家获胜
   */
  checkWinner(board) {
    const size = 15;
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
  },

  /**
   * 检查位置是否有效
   */
  isValidPosition(row, col, size) {
    return row >= 0 && row < size && col >= 0 && col < size;
  },

  /**
   * 结束游戏
   */
  endGame(winner) {
    this.setData({
      gameOver: true,
      winner: winner
    });

    const message = winner === 1 ? '恭喜！你赢了！' : 'AI获胜！';
    wx.showModal({
      title: '游戏结束',
      content: message,
      showCancel: false,
      success: () => {
        this.initGame(); // 重新开始游戏
      }
    });
  },

  /**
   * 重新开始游戏
   */
  restartGame() {
    this.initGame();
  }
});
