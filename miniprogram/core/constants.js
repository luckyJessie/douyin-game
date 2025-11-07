const BOARD_SIZE = 15;
const WIN_COUNT = 5;

const PLAYER = {
  HUMAN: 1,
  AI: 2
};

const CELL = {
  EMPTY: 0,
  HUMAN: PLAYER.HUMAN,
  AI: PLAYER.AI
};

const SEARCH_DEPTH = {
  EASY: 1,
  NORMAL: 2,
  HARD: 3
};

const CLOUD_COLLECTION = 'rooms';

module.exports = {
  BOARD_SIZE,
  WIN_COUNT,
  PLAYER,
  CELL,
  SEARCH_DEPTH,
  CLOUD_COLLECTION
};
