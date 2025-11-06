/**
 * 开局库 - 存储常见开局模式
 */
class OpeningBook {
  constructor() {
    // 常见的优秀开局位置（相对于中心）
    // key: 局面特征字符串, value: 推荐位置 [{row, col}]
    this.openings = new Map()
    
    // 初始化一些经典开局
    this.initOpenings()
  }

  initOpenings() {
    const size = 15
    const center = Math.floor(size / 2)

    // 天元开局（中心）
    this.openings.set('empty', [
      { row: center, col: center }
    ])

    // 如果对手下在天元，常见的应对
    this.openings.set(`${center},${center}`, [
      { row: center - 1, col: center },      // 上
      { row: center + 1, col: center },      // 下
      { row: center, col: center - 1 },     // 左
      { row: center, col: center + 1 },      // 右
      { row: center - 1, col: center - 1 }, // 左上
      { row: center - 1, col: center + 1 }, // 右上
      { row: center + 1, col: center - 1 }, // 左下
      { row: center + 1, col: center + 1 }  // 右下
    ])

    // 边角位置的开局
    const cornerOffsets = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (let [dr, dc] of cornerOffsets) {
      const key = `${center + dr},${center + dc}`
      this.openings.set(key, [
        { row: center, col: center },           // 回到中心
        { row: center - dr, col: center - dc }, // 对称位置
        { row: center + dr, col: center + dc }  // 同方向
      ])
    }
  }

  /**
   * 根据当前局面查找开局库中的推荐走法
   * @param {Array} board - 棋盘状态
   * @param {number} moveCount - 当前已走的步数
   * @returns {Object|null} - 推荐的位置 {row, col} 或 null
   */
  getMove(board, moveCount) {
    // 只在开局前10步使用开局库
    if (moveCount > 10) {
      return null
    }

    // 如果棋盘为空，返回中心位置
    if (this.matchPattern(board, 'empty')) {
      const moves = this.openings.get('empty')
      if (moves && moves.length > 0) {
        return moves[0]
      }
    }

    // 查找匹配的开局模式（按最近下的位置匹配）
    const size = board.length
    const center = Math.floor(size / 2)
    
    // 查找最后一个下的位置（通常是最新的对手走法）
    for (let i = Math.max(0, center - 3); i <= Math.min(size - 1, center + 3); i++) {
      for (let j = Math.max(0, center - 3); j <= Math.min(size - 1, center + 3); j++) {
        if (board[i] && board[i][j] !== 0) {
          const pattern = `${i},${j}`
          const moves = this.openings.get(pattern)
          if (moves) {
            // 筛选出有效的推荐位置
            const validMoves = moves.filter(move => 
              move.row >= 0 && move.row < size &&
              move.col >= 0 && move.col < size &&
              board[move.row] && 
              board[move.row][move.col] === 0
            )
            if (validMoves.length > 0) {
              // 优先选择中心附近的推荐位置
              validMoves.sort((a, b) => {
                const distA = Math.abs(a.row - center) + Math.abs(a.col - center)
                const distB = Math.abs(b.row - center) + Math.abs(b.col - center)
                return distA - distB
              })
              return validMoves[0]
            }
          }
        }
      }
    }

    return null
  }

  /**
   * 提取局面特征
   */
  extractFeatures(board) {
    const size = board.length
    const center = Math.floor(size / 2)
    const features = []

    // 检查中心区域是否有棋子
    for (let i = center - 2; i <= center + 2; i++) {
      for (let j = center - 2; j <= center + 2; j++) {
        if (board[i] && board[i][j] !== 0) {
          features.push(`${i},${j}`)
        }
      }
    }

    return features.join('|')
  }

  /**
   * 匹配开局模式
   */
  matchPattern(board, pattern) {
    if (pattern === 'empty') {
      // 检查是否为空棋盘
      const size = board.length
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (board[i][j] !== 0) {
            return false
          }
        }
      }
      return true
    }

    // 检查特定位置是否有棋子
    const [row, col] = pattern.split(',').map(Number)
    return board[row] && board[row][col] !== 0
  }
}

module.exports = OpeningBook
