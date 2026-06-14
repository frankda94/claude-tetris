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
const nameInputSection = document.getElementById('name-input-section');
const playerNameInput = document.getElementById('player-name');
const saveScoreBtn = document.getElementById('save-score-btn');
const recordsBody = document.getElementById('records-body');
const bestScoreEl = document.getElementById('best-score');
const bestComboEl = document.getElementById('best-combo');
const bestLinesEl = document.getElementById('best-lines');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const recordsSection = document.getElementById('records-section');

const pauseOverlay = document.getElementById('pause-overlay');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsView = document.getElementById('controls-view');
const startLevelValueEl = document.getElementById('start-level-value');
const levelDownBtn = document.getElementById('level-down-btn');
const levelUpBtn = document.getElementById('level-up-btn');

const HIGHSCORES_KEY = 'tetris-highscores';
const LAST_NAME_KEY = 'tetris-last-name';
const MAX_RECORDS = 5;
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 15;

let board, current, next, score, lines, level, combo, maxCombo, paused, gameOver, started, scoreSaved, lastTime, dropAccum, dropInterval, animId;
let startLevel = loadStartLevel();

function loadStartLevel() {
  const stored = parseInt(localStorage.getItem('tetris-start-level'), 10);
  if (Number.isNaN(stored)) return 1;
  return Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, stored));
}

function updateStartLevelDisplay() {
  startLevelValueEl.textContent = startLevel;
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(records));
}

function addRecord(entry) {
  const records = loadRecords();
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  const top = records.slice(0, MAX_RECORDS);
  saveRecords(top);
  return top;
}

function renderRecords(records, highlightEntry) {
  recordsBody.innerHTML = '';

  let topScore = 0, topCombo = 0, topLines = 0;
  for (const r of records) {
    topScore = Math.max(topScore, r.score || 0);
    topCombo = Math.max(topCombo, r.combo || 0);
    topLines = Math.max(topLines, r.lines || 0);
  }
  bestScoreEl.textContent = topScore.toLocaleString();
  bestComboEl.textContent = topCombo;
  bestLinesEl.textContent = topLines;

  if (records.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.textContent = 'Sin récords todavía';
    cell.className = 'no-records';
    row.appendChild(cell);
    recordsBody.appendChild(row);
    return;
  }

  records.forEach((r, i) => {
    const row = document.createElement('tr');
    if (highlightEntry && r === highlightEntry) {
      row.classList.add('highlight');
    }
    const cells = [i + 1, r.name, r.score.toLocaleString(), r.lines, r.combo];
    for (const val of cells) {
      const td = document.createElement('td');
      td.textContent = val;
      row.appendChild(td);
    }
    recordsBody.appendChild(row);
  });
}

function refreshRecordsDisplay(highlightEntry) {
  renderRecords(loadRecords(), highlightEntry);
}

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
    maxCombo = Math.max(maxCombo, combo);
    updateHUD();
  } else {
    combo = 0;
  }
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = isLight() ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
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
  scoreSaved = false;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} | Líneas: ${lines} | Combo máx: ${maxCombo}`;
  restartBtn.textContent = 'Jugar de nuevo';

  const lastName = localStorage.getItem(LAST_NAME_KEY) || '';
  playerNameInput.value = lastName || 'Player';
  nameInputSection.classList.remove('hidden');
  recordsSection.classList.remove('hidden');

  refreshRecordsDisplay(null);
  overlay.classList.remove('hidden');
}

function saveCurrentScore() {
  if (scoreSaved) return;
  const name = (playerNameInput.value || 'Player').trim().slice(0, 12) || 'Player';
  localStorage.setItem(LAST_NAME_KEY, name);
  const entry = { name, score, lines, combo: maxCombo, date: new Date().toISOString() };
  const records = addRecord(entry);
  scoreSaved = true;
  const madeTop = records.includes(entry);
  renderRecords(records, madeTop ? entry : null);
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    controlsView.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseOverlay.classList.remove('hidden');
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
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = true;
  scoreSaved = false;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameInputSection.classList.add('hidden');
  recordsSection.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  controlsView.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function showStartScreen() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = false;
  next = randomPiece();
  current = randomPiece();
  updateHUD();
  draw();
  drawNext();

  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  nameInputSection.classList.add('hidden');
  recordsSection.classList.remove('hidden');
  refreshRecordsDisplay(null);
  overlay.classList.remove('hidden');
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (!started || paused || gameOver) return;
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

restartBtn.addEventListener('click', () => {
  if (gameOver) saveCurrentScore();
  init();
});

saveScoreBtn.addEventListener('click', saveCurrentScore);
playerNameInput.addEventListener('blur', saveCurrentScore);
playerNameInput.addEventListener('keydown', e => {
  if (e.code === 'Enter') saveCurrentScore();
});

resetRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los récords guardados?')) return;
  localStorage.removeItem(HIGHSCORES_KEY);
  refreshRecordsDisplay(null);
});

resumeBtn.addEventListener('click', () => {
  if (paused) togglePause();
});

pauseRestartBtn.addEventListener('click', () => {
  init();
});

controlsBtn.addEventListener('click', () => {
  controlsView.classList.toggle('hidden');
});

levelDownBtn.addEventListener('click', () => {
  startLevel = Math.max(MIN_START_LEVEL, startLevel - 1);
  localStorage.setItem('tetris-start-level', startLevel);
  updateStartLevelDisplay();
});

levelUpBtn.addEventListener('click', () => {
  startLevel = Math.min(MAX_START_LEVEL, startLevel + 1);
  localStorage.setItem('tetris-start-level', startLevel);
  updateStartLevelDisplay();
});

updateStartLevelDisplay();

const themeToggle = document.getElementById('theme-toggle');
themeToggle.addEventListener('change', e => {
  document.body.classList.toggle('light-mode', e.target.checked);
  localStorage.setItem('theme', e.target.checked ? 'light' : 'dark');
});
if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('light-mode');
  themeToggle.checked = true;
}

showStartScreen();
