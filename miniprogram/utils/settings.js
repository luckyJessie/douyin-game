const DIFFICULTY_SETTINGS = [
  { label: '初级', depth: 1, candidateLimit: 8, method: 'minimax', mctsIterations: 0 },
  { label: '中级', depth: 2, candidateLimit: 12, method: 'minimax', mctsIterations: 0 },
  { label: '高级', depth: 3, candidateLimit: 14, method: 'minimax', mctsIterations: 0 },
  { label: '大师', depth: 2, candidateLimit: 16, method: 'mcts', mctsIterations: 1400 }
];

module.exports = {
  DIFFICULTY_SETTINGS
};
