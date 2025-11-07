// pages/index/index.js
Page({
  data: {
    board: [], // 棋盘：0-空，1-黑棋，2-白棋
    currentPlayer: 1, // 当前玩家：1-黑棋，2-白棋
    gameOver: false,
    statusText: '黑棋先行',
    canUndo: false,
    moveHistory: [] // 记录每一步棋
  },

  onLoad() {
    this.initBoard();
  },

  // 初始化棋盘
  initBoard() {
    const board = [];
    for (let i = 0; i < 15; i++) {
      board.push(new Array(15).fill(0));
    }
    this.setData({
      board: board,
      currentPlayer: 1,
      gameOver: false,
      statusText: '黑棋先行',
      canUndo: false,
      moveHistory: []
    });
  },

  // 点击棋盘格子
  onCellTap(e) {
    if (this.data.gameOver) {
      wx.showToast({
        title: '游戏已结束',
        icon: 'none'
      });
      return;
    }

    const row = e.currentTarget.dataset.row;
    const col = e.currentTarget.dataset.col;
    
    if (this.data.board[row][col] !== 0) {
      wx.showToast({
        title: '此处已有棋子',
        icon: 'none'
      });
      return;
    }

    // 落子
    this.makeMove(row, col);
  },

  // 落子
  makeMove(row, col) {
    const board = JSON.parse(JSON.stringify(this.data.board));
    const currentPlayer = this.data.currentPlayer;
    
    board[row][col] = currentPlayer;
    
    // 记录这一步
    const moveHistory = [...this.data.moveHistory, { row, col, player: currentPlayer }];
    
    // 检查是否获胜
    const isWin = this.checkWin(board, row, col, currentPlayer);
    
    if (isWin) {
      this.setData({
        board: board,
        gameOver: true,
        statusText: currentPlayer === 1 ? '黑棋获胜！' : '白棋获胜！',
        moveHistory: moveHistory,
        canUndo: false
      });
      
      wx.showToast({
        title: currentPlayer === 1 ? '黑棋获胜！' : '白棋获胜！',
        icon: 'success',
        duration: 2000
      });
    } else {
      // 切换玩家
      const nextPlayer = currentPlayer === 1 ? 2 : 1;
      this.setData({
        board: board,
        currentPlayer: nextPlayer,
        statusText: nextPlayer === 1 ? '黑棋回合' : '白棋回合',
        moveHistory: moveHistory,
        canUndo: moveHistory.length > 0
      });
    }
  },

  // 检查是否获胜
  checkWin(board, row, col, player) {
    const directions = [
      [[0, 1], [0, -1]],   // 横向
      [[1, 0], [-1, 0]],   // 纵向
      [[1, 1], [-1, -1]],  // 主对角线
      [[1, -1], [-1, 1]]   // 副对角线
    ];

    for (let dir of directions) {
      let count = 1; // 包含当前棋子
      
      // 检查两个方向
      for (let d of dir) {
        let r = row + d[0];
        let c = col + d[1];
        
        while (r >= 0 && r < 15 && c >= 0 && c < 15 && board[r][c] === player) {
          count++;
          r += d[0];
          c += d[1];
        }
      }
      
      if (count >= 5) {
        return true;
      }
    }
    
    return false;
  },

  // 重新开始
  resetGame() {
    wx.showModal({
      title: '确认',
      content: '确定要重新开始游戏吗？',
      success: (res) => {
        if (res.confirm) {
          this.initBoard();
        }
      }
    });
  },

  // 悔棋
  undoMove() {
    if (this.data.gameOver || this.data.moveHistory.length === 0) {
      return;
    }

    const moveHistory = [...this.data.moveHistory];
    const lastMove = moveHistory.pop();
    
    if (!lastMove) return;
    
    const board = JSON.parse(JSON.stringify(this.data.board));
    board[lastMove.row][lastMove.col] = 0;
    
    // 如果只剩一步，不能悔棋
    const canUndo = moveHistory.length > 0;
    
    // 切换回上一个玩家
    const prevPlayer = lastMove.player === 1 ? 2 : 1;
    
    this.setData({
      board: board,
      currentPlayer: prevPlayer,
      statusText: prevPlayer === 1 ? '黑棋回合' : '白棋回合',
      moveHistory: moveHistory,
      canUndo: canUndo
    });
  }
});
