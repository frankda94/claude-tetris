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

const SKINS = {
  retro: {
    name: 'Retro',
    colors: COLORS,
    boardBg: null, // use CSS variable
    draw(context, x, y, colorIndex, size, alpha) {
      const color = SKINS.retro.colors[colorIndex];
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
      context.fillStyle = isLight() ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
      context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
      context.globalAlpha = 1;
    },
  },
  neon: {
    name: 'Neon',
    colors: [
      null,
      '#00f6ff', // I - cyan
      '#fff700', // O - yellow
      '#ff00f7', // T - magenta
      '#39ff14', // S - green
      '#ff2d55', // Z - red
      '#3a86ff', // J - blue
      '#ff9100', // L - orange
    ],
    boardBg: '#000000',
    draw(context, x, y, colorIndex, size, alpha) {
      const color = SKINS.neon.colors[colorIndex];
      context.save();
      context.globalAlpha = alpha ?? 1;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.fillStyle = color;
      context.fillRect(x * size + 2, y * size + 2, size - 4, size - 4);
      context.shadowBlur = 0;
      context.strokeStyle = color;
      context.lineWidth = 1;
      context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
      context.restore();
    },
  },
  pastel: {
    name: 'Pastel',
    colors: [
      null,
      '#aee3f0', // I - light blue
      '#fff3b0', // O - light yellow
      '#dcc6f0', // T - lavender
      '#c5ecc8', // S - mint
      '#f7c6c7', // Z - pink
      '#c9dcf5', // J - powder blue
      '#fbdfb8', // L - peach
    ],
    boardBg: null,
    draw(context, x, y, colorIndex, size, alpha) {
      const color = SKINS.pastel.colors[colorIndex];
      const px = x * size + 1;
      const py = y * size + 1;
      const w = size - 2;
      const h = size - 2;
      const r = Math.min(6, w / 3, h / 3);
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.beginPath();
      if (context.roundRect) {
        context.roundRect(px, py, w, h, r);
      } else {
        context.moveTo(px + r, py);
        context.lineTo(px + w - r, py);
        context.arcTo(px + w, py, px + w, py + r, r);
        context.lineTo(px + w, py + h - r);
        context.arcTo(px + w, py + h, px + w - r, py + h, r);
        context.lineTo(px + r, py + h);
        context.arcTo(px, py + h, px, py + h - r, r);
        context.lineTo(px, py + r);
        context.arcTo(px, py, px + r, py, r);
        context.closePath();
      }
      context.fill();
      context.globalAlpha = 1;
    },
  },
  pixel: {
    name: 'Pixel Art',
    colors: COLORS,
    boardBg: null,
    draw(context, x, y, colorIndex, size, alpha) {
      const color = SKINS.pixel.colors[colorIndex];
      const px = x * size + 1;
      const py = y * size + 1;
      const w = size - 2;
      const h = size - 2;
      context.globalAlpha = alpha ?? 1;
      context.fillStyle = color;
      context.fillRect(px, py, w, h);

      // checkered texture pattern drawn on top
      const cell = Math.max(4, Math.floor(size / 6));
      context.fillStyle = isLight() ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.15)';
      for (let ty = 0; ty < h; ty += cell) {
        for (let tx = 0; tx < w; tx += cell) {
          const checker = ((Math.floor(tx / cell) + Math.floor(ty / cell)) % 2) === 0;
          if (checker) {
            const cw = Math.min(cell, w - tx);
            const ch = Math.min(cell, h - ty);
            context.fillRect(px + tx, py + ty, cw, ch);
          }
        }
      }

      // border to emphasize pixel grid
      context.strokeStyle = isLight() ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.35)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
      context.globalAlpha = 1;
    },
  },
};

let currentSkin = 'retro';

function getSkin() {
  return SKINS[currentSkin] || SKINS.retro;
}

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

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

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
    updateHUD();
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
  getSkin().draw(context, x, y, colorIndex, size, alpha);
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

function drawBoardBackground() {
  const skin = getSkin();
  if (skin.boardBg) {
    ctx.fillStyle = skin.boardBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBoardBackground();
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
  const skin = getSkin();
  if (skin.boardBg) {
    nextCtx.fillStyle = skin.boardBg;
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  }
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
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
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
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
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
  currentSkin = SKINS[e.target.value] ? e.target.value : 'retro';
  localStorage.setItem('skin', currentSkin);
  draw();
  drawNext();
});
const savedSkin = localStorage.getItem('skin');
if (savedSkin && SKINS[savedSkin]) {
  currentSkin = savedSkin;
}
skinSelect.value = currentSkin;

init();
