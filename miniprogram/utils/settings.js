const { SEARCH_DEPTH } = require('../core/constants');

const DIFFICULTY_SETTINGS = [
  { label: '初级', depth: SEARCH_DEPTH.EASY },
  { label: '中级', depth: SEARCH_DEPTH.NORMAL },
  { label: '高级', depth: SEARCH_DEPTH.HARD },
  { label: '大师', depth: SEARCH_DEPTH.HARD + 1 }
];

module.exports = {
  DIFFICULTY_SETTINGS
};
