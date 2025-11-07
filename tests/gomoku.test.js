const assert = require("assert");
const {
  PLAYER_BLACK,
  PLAYER_WHITE,
  createEmptyBoard,
  cloneBoard,
  togglePlayer,
  hasEmptyCell,
  checkWinner,
  findBestMove
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
  testAiFindsWinningMove();
  testAiBlocksOpponent();
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

function testAiFindsWinningMove() {
  let board = createEmptyBoard(15);
  board = placeStone(board, 7, 7, PLAYER_WHITE);
  board = placeStone(board, 7, 8, PLAYER_WHITE);
  board = placeStone(board, 7, 9, PLAYER_WHITE);
  board = placeStone(board, 7, 10, PLAYER_WHITE);
  const move = findBestMove(board, PLAYER_WHITE, PLAYER_BLACK);
  const winningOptions = [
    { row: 7, col: 6 },
    { row: 7, col: 11 }
  ];
  assert(
    winningOptions.some((option) => option.row === move.row && option.col === move.col),
    "AI 应寻找立即获胜的落点"
  );
}

function testAiBlocksOpponent() {
  let board = createEmptyBoard(15);
  board = placeStone(board, 5, 5, PLAYER_BLACK);
  board = placeStone(board, 6, 6, PLAYER_BLACK);
  board = placeStone(board, 7, 7, PLAYER_BLACK);
  board = placeStone(board, 8, 8, PLAYER_BLACK);
  const move = findBestMove(board, PLAYER_WHITE, PLAYER_BLACK);
  const blockingOptions = [
    { row: 4, col: 4 },
    { row: 9, col: 9 }
  ];
  assert(
    blockingOptions.some((option) => option.row === move.row && option.col === move.col),
    "AI 应阻挡对手的连五机会"
  );
}

runTests();
