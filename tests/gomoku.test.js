const assert = require("assert");
const {
  PLAYER_BLACK,
  PLAYER_WHITE,
  createEmptyBoard,
  cloneBoard,
  togglePlayer,
  hasEmptyCell,
  checkWinner
} = require("../utils/gomoku");

function placeStone(board, row, col, player) {
  const nextBoard = cloneBoard(board);
  nextBoard[row][col] = player;
  return nextBoard;
}

function runTests() {
  testHorizontalWin();
  testVerticalWin();
  testDiagonalWin();
  testHasEmptyCell();
  testTogglePlayer();
  console.log("✅ gomoku utils 测试全部通过");
}

function testHorizontalWin() {
  let board = createEmptyBoard(15);
  for (let i = 0; i < 5; i += 1) {
    board = placeStone(board, 7, i, PLAYER_BLACK);
  }
  const winner = checkWinner(board, 7, 4, PLAYER_BLACK);
  assert.strictEqual(winner, PLAYER_BLACK, "横向五连应判定黑棋胜出");
}

function testVerticalWin() {
  let board = createEmptyBoard(15);
  for (let i = 0; i < 5; i += 1) {
    board = placeStone(board, i, 10, PLAYER_WHITE);
  }
  const winner = checkWinner(board, 4, 10, PLAYER_WHITE);
  assert.strictEqual(winner, PLAYER_WHITE, "纵向五连应判定白棋胜出");
}

function testDiagonalWin() {
  let board = createEmptyBoard(15);
  for (let i = 0; i < 5; i += 1) {
    board = placeStone(board, i + 3, i + 3, PLAYER_BLACK);
  }
  const winner = checkWinner(board, 7, 7, PLAYER_BLACK);
  assert.strictEqual(winner, PLAYER_BLACK, "斜向五连应判定黑棋胜出");
}

function testHasEmptyCell() {
  const board = createEmptyBoard(2).map((row) => row.map(() => PLAYER_BLACK));
  assert.strictEqual(hasEmptyCell(board), false, "棋盘已满时应返回 false");
}

function testTogglePlayer() {
  assert.strictEqual(togglePlayer(PLAYER_BLACK), PLAYER_WHITE, "黑棋应切换为白棋");
  assert.strictEqual(togglePlayer(PLAYER_WHITE), PLAYER_BLACK, "白棋应切换为黑棋");
}

runTests();
