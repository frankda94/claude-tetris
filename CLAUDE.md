# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Open directly or serve statically:

```powershell
# Windows
start index.html

# or with a local server
python -m http.server 8000
# then open http://localhost:8000
```

No `package.json`, no bundler, no transpiler.

## Architecture

Three files, no dependencies:

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600 px) for the board, `<canvas id="next-canvas">` (120×120 px) for the preview, sidebar HUD (`#score`, `#lines`, `#level`), and `#overlay` for pause/game-over states.
- **`style.css`** — Dark retro theme. Flexbox layout, monospace HUD, `backdrop-filter` on overlays.
- **`game.js`** — All game logic (~300 lines, `'use strict'`, no modules).

### game.js key structure

| Symbol                   | Role                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| `COLS`, `ROWS`, `BLOCK`  | Board dimensions (10×20, 30 px/cell)                                         |
| `PIECES[1–7]`            | Shape matrices; index value = color index                                    |
| `board`                  | `ROWS×COLS` number array; `0` = empty, `1–7` = locked piece color            |
| `current` / `next`       | `{type, shape, x, y}` objects                                                |
| `collide(shape, ox, oy)` | Bounds + overlap check                                                       |
| `tryRotate()`            | `rotateCW` + wall kicks `[0, ±1, ±2]`                                        |
| `lockPiece()`            | `merge → clearLines → spawn`                                                 |
| `loop(ts)`               | `requestAnimationFrame` loop; accumulates `dropAccum` against `dropInterval` |
| `init()`                 | Full reset; called on load and restart                                       |

Speed formula: `dropInterval = max(100, 1000 − (level − 1) × 90)` ms. Level increments every 10 lines.

Canvas `width`/`height` in `index.html` must stay in sync with `COLS × BLOCK` and `ROWS × BLOCK` if those constants change.
