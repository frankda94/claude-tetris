'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PASTEL_COLORS = [
  null,
  '#a8e6e8', // I - pastel cyan
  '#fff2b2', // O - pastel yellow
  '#dcb8ea', // T - pastel purple
  '#c2eccb', // S - pastel green
  '#f7c6c6', // Z - pastel red
  '#c5dffc', // J - pastel blue
  '#ffdcb0', // L - pastel orange
];

const SKINS = {
  retro: { colors: COLORS, glow: false, rounded: false, pattern: false },
  neon: { colors: COLORS, glow: true, rounded: false, pattern: false },
  pastel: { colors: PASTEL_COLORS, glow: false, rounded: true, pattern: false },
  pixel: { colors: COLORS, glow: false, rounded: false, pattern: true },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const gameoverBox = document.getElementById('gameover-box');
const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const restartPauseBtn = document.getElementById('restart-pause-btn');
const controlsBtn = document.getElementById('controls-btn');
const backControlsBtn = document.getElementById('back-controls-btn');
const startLevelSelect = document.getElementById('start-level-select');
const highscoreList = document.getElementById('highscore-list');
const bestComboEl = document.getElementById('best-combo');
const maxLinesEl = document.getElementById('max-lines');
const resetHighscoresBtn = document.getElementById('reset-highscores-btn');
const highscoreInput = document.getElementById('highscore-input');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const overlayHighscores = document.getElementById('overlay-highscores');

const HIGHSCORES_KEY = 'tetris-highscores';
const BEST_COMBO_KEY = 'tetris-best-combo';
const MAX_LINES_KEY = 'tetris-max-lines';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, combo, bestComboThisGame;
let currentSkin = localStorage.getItem('tetris-skin') || 'retro';

let startLevel = parseInt(localStorage.getItem('tetris-start-level'), 10);
if (!Number.isInteger(startLevel) || startLevel < 1 || startLevel > 10) startLevel = 1;
startLevelSelect.value = String(startLevel);

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    combo++;
    bestComboThisGame = Math.max(bestComboThisGame, combo);
    updateHUD();
  } else {
    combo = 0;
  }
}

function getHighscores() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIGHSCORES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
}

function getBestCombo() {
  return Number(localStorage.getItem(BEST_COMBO_KEY)) || 0;
}

function setBestCombo(n) {
  localStorage.setItem(BEST_COMBO_KEY, String(n));
}

function getMaxLines() {
  return Number(localStorage.getItem(MAX_LINES_KEY)) || 0;
}

function setMaxLines(n) {
  localStorage.setItem(MAX_LINES_KEY, String(n));
}

function renderHighscores(highlightIndex) {
  const list = getHighscores();
  highscoreList.innerHTML = '';
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    if (i === highlightIndex) li.classList.add('highlight');
    li.innerHTML = `<span class="hs-name">${entry.name}</span><span class="hs-score">${entry.score.toLocaleString()}</span>`;
    highscoreList.appendChild(li);
  });
  bestComboEl.textContent = getBestCombo();
  maxLinesEl.textContent = getMaxLines();
}

function renderOverlayHighscores(highlightIndex) {
  const list = getHighscores();
  overlayHighscores.innerHTML = '';
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    if (i === highlightIndex) li.classList.add('highlight');
    li.innerHTML = `<span class="hs-name">${entry.name}</span><span class="hs-score">${entry.score.toLocaleString()}</span>`;
    overlayHighscores.appendChild(li);
  });
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function isLight() {
  return document.body.classList.contains('light-mode');
}

function roundedRectPath(context, x, y, w, h, r) {
  if (typeof context.roundRect === 'function') {
    context.beginPath();
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  const color = skin.colors[colorIndex];
  const bx = x * size + 1;
  const by = y * size + 1;
  const bs = size - 2;

  context.globalAlpha = alpha ?? 1;

  if (skin.glow) {
    context.shadowBlur = 12;
    context.shadowColor = color;
  }

  context.fillStyle = color;

  if (skin.rounded) {
    roundedRectPath(context, bx, by, bs, bs, Math.max(2, size * 0.18));
    context.fill();
  } else {
    context.fillRect(bx, by, bs, bs);
  }

  if (skin.glow) {
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
  }

  if (skin.pattern) {
    // Pixel-art texture overlay: 2x2 sub-grid with alternating shading.
    const half = bs / 2;
    context.fillStyle = 'rgba(0,0,0,0.10)';
    context.fillRect(bx, by, half, half);
    context.fillRect(bx + half, by + half, half, half);
    context.fillStyle = 'rgba(255,255,255,0.10)';
    context.fillRect(bx + half, by, half, half);
    context.fillRect(bx, by + half, half, half);
  }

  if (!skin.rounded && !skin.pattern) {
    context.fillStyle = isLight() ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
    context.fillRect(bx, by, bs, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = isLight() ? '#dddde8' : '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  pauseMenu.classList.add('hidden');
  gameoverBox.classList.remove('hidden');
  overlay.classList.remove('hidden');

  if (bestComboThisGame > getBestCombo()) setBestCombo(bestComboThisGame);
  if (lines > getMaxLines()) setMaxLines(lines);

  const highscores = getHighscores();
  const qualifies = highscores.length < 5 ||
    score > highscores[highscores.length - 1].score;

  if (qualifies) {
    highscoreInput.classList.remove('hidden');
    overlayHighscores.classList.add('hidden');
    playerNameInput.value = '';
    playerNameInput.focus();
  } else {
    highscoreInput.classList.add('hidden');
    overlayHighscores.classList.remove('hidden');
    renderOverlayHighscores(-1);
  }

  renderHighscores();
}

function saveHighscore() {
  let name = playerNameInput.value.trim().slice(0, 8);
  if (!name) name = 'AAA';

  const highscores = getHighscores();
  highscores.push({ name, score });
  highscores.sort((a, b) => b.score - a.score);
  highscores.splice(5);
  saveHighscores(highscores);

  const highlightIndex = highscores.findIndex(
    e => e.name === name && e.score === score
  );

  renderHighscores(highlightIndex);

  highscoreInput.classList.add('hidden');
  overlayHighscores.classList.remove('hidden');
  renderOverlayHighscores(highlightIndex);
}

function showPauseMenu() {
  pauseMain.classList.remove('hidden');
  pauseControls.classList.add('hidden');
  gameoverBox.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function hidePauseMenu() {
  pauseMenu.classList.add('hidden');
  overlay.classList.add('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    hidePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    showPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  combo = 0;
  bestComboThisGame = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  gameoverBox.classList.remove('hidden');
  pauseMenu.classList.add('hidden');
  highscoreInput.classList.add('hidden');
  overlayHighscores.classList.add('hidden');
  renderHighscores();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

restartPauseBtn.addEventListener('click', () => {
  hidePauseMenu();
  paused = false;
  init();
});

controlsBtn.addEventListener('click', () => {
  pauseMain.classList.add('hidden');
  pauseControls.classList.remove('hidden');
});

backControlsBtn.addEventListener('click', () => {
  pauseControls.classList.add('hidden');
  pauseMain.classList.remove('hidden');
});

startLevelSelect.addEventListener('change', e => {
  let value = parseInt(e.target.value, 10);
  if (!Number.isInteger(value) || value < 1 || value > 10) value = 1;
  startLevel = value;
  localStorage.setItem('tetris-start-level', String(startLevel));
});

saveScoreBtn.addEventListener('click', saveHighscore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveHighscore();
});

resetHighscoresBtn.addEventListener('click', () => {
  localStorage.removeItem(HIGHSCORES_KEY);
  localStorage.removeItem(BEST_COMBO_KEY);
  localStorage.removeItem(MAX_LINES_KEY);
  renderHighscores();
});

const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('change', e => {
  document.body.classList.toggle('light-mode', e.target.checked);
  localStorage.setItem('theme', e.target.checked ? 'light' : 'dark');
});
if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('light-mode');
  themeToggle.checked = true;
}

const skinSelect = document.getElementById('skin-select');
skinSelect.addEventListener('change', e => {
  currentSkin = e.target.value;
  localStorage.setItem('tetris-skin', currentSkin);
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel');
  document.body.classList.add(`skin-${currentSkin}`);
  draw();
  drawNext();
});
skinSelect.value = currentSkin;
document.body.classList.add(`skin-${currentSkin}`);

init();
