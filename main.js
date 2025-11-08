/* Tetris implementation - vanilla JS */
(function() {
  'use strict';

  // DOM references
  const boardCanvas = document.getElementById('board');
  const nextCanvas = document.getElementById('next');
  const holdCanvas = document.getElementById('hold');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const linesEl = document.getElementById('lines');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');

  const boardCtx = boardCanvas.getContext('2d');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCtx = holdCanvas.getContext('2d');

  // Board settings
  const COLS = 10;
  const ROWS = 20;
  const CELL_SIZE = Math.floor(boardCanvas.width / COLS); // 30 for 300px
  const BOARD_W = COLS * CELL_SIZE;
  const BOARD_H = ROWS * CELL_SIZE;

  // Colors for tetrominoes (I, O, T, S, Z, J, L)
  const COLORS = {
    I: '#38d1ff',
    O: '#ffd43b',
    T: '#c084fc',
    S: '#22c55e',
    Z: '#ef4444',
    J: '#60a5fa',
    L: '#f59e0b',
    G: '#1f254d' // ghost / grid
  };

  // Piece definitions using rotation states
  const SHAPES = {
    I: [
      [ [0,1],[1,1],[2,1],[3,1] ],
      [ [2,0],[2,1],[2,2],[2,3] ],
      [ [0,2],[1,2],[2,2],[3,2] ],
      [ [1,0],[1,1],[1,2],[1,3] ]
    ],
    O: [
      [ [1,0],[2,0],[1,1],[2,1] ],
      [ [1,0],[2,0],[1,1],[2,1] ],
      [ [1,0],[2,0],[1,1],[2,1] ],
      [ [1,0],[2,0],[1,1],[2,1] ]
    ],
    T: [
      [ [1,0],[0,1],[1,1],[2,1] ],
      [ [1,0],[1,1],[2,1],[1,2] ],
      [ [0,1],[1,1],[2,1],[1,2] ],
      [ [1,0],[0,1],[1,1],[1,2] ]
    ],
    S: [
      [ [1,0],[2,0],[0,1],[1,1] ],
      [ [1,0],[1,1],[2,1],[2,2] ],
      [ [1,1],[2,1],[0,2],[1,2] ],
      [ [0,0],[0,1],[1,1],[1,2] ]
    ],
    Z: [
      [ [0,0],[1,0],[1,1],[2,1] ],
      [ [2,0],[1,1],[2,1],[1,2] ],
      [ [0,1],[1,1],[1,2],[2,2] ],
      [ [1,0],[0,1],[1,1],[0,2] ]
    ],
    J: [
      [ [0,0],[0,1],[1,1],[2,1] ],
      [ [1,0],[2,0],[1,1],[1,2] ],
      [ [0,1],[1,1],[2,1],[2,2] ],
      [ [1,0],[1,1],[0,2],[1,2] ]
    ],
    L: [
      [ [2,0],[0,1],[1,1],[2,1] ],
      [ [1,0],[1,1],[1,2],[2,2] ],
      [ [0,1],[1,1],[2,1],[0,2] ],
      [ [0,0],[1,0],[1,1],[1,2] ]
    ]
  };

  const KICKS = {
    I: {
      '0>1': [[-2,0], [1,0], [-2,-1], [1,2]],
      '1>0': [[2,0], [-1,0], [2,1], [-1,-2]],
      '1>2': [[-1,0], [2,0], [-1,2], [2,-1]],
      '2>1': [[1,0], [-2,0], [1,-2], [-2,1]],
      '2>3': [[2,0], [-1,0], [2,1], [-1,-2]],
      '3>2': [[-2,0], [1,0], [-2,-1], [1,2]],
      '3>0': [[1,0], [-2,0], [1,-2], [-2,1]],
      '0>3': [[-1,0], [2,0], [-1,2], [2,-1]]
    },
    default: {
      '0>1': [[-1,0], [-1,1], [0,-2], [-1,-2]],
      '1>0': [[1,0], [1,-1], [0,2], [1,2]],
      '1>2': [[1,0], [1,-1], [0,2], [1,2]],
      '2>1': [[-1,0], [-1,1], [0,-2], [-1,-2]],
      '2>3': [[1,0], [1,1], [0,-2], [1,-2]],
      '3>2': [[-1,0], [-1,-1], [0,2], [-1,2]],
      '3>0': [[-1,0], [-1,-1], [0,2], [-1,2]],
      '0>3': [[1,0], [1,1], [0,-2], [1,-2]]
    }
  };

  function createMatrix(cols, rows, fill = 0) {
    const m = new Array(rows);
    for (let y = 0; y < rows; y++) {
      const row = new Array(cols);
      for (let x = 0; x < cols; x++) row[x] = fill;
      m[y] = row;
    }
    return m;
  }

  function drawCell(ctx, x, y, color) {
    const px = x * CELL_SIZE;
    const py = y * CELL_SIZE;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  }

  const state = {
    board: createMatrix(COLS, ROWS, 0),
    bag: [],
    queue: [],
    current: null,
    held: null,
    holdUsed: false,
    score: 0,
    level: 1,
    lines: 0,
    dropTimer: 0,
    dropIntervalMs: 1000,
    running: false,
    paused: false,
    lastTime: 0
  };

  function resetBoard() { state.board = createMatrix(COLS, ROWS, 0); }

  function newBag() {
    const pieces = ['I','O','T','S','Z','J','L'];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
  }

  function ensureQueue(n = 5) {
    while (state.queue.length < n) {
      if (state.bag.length === 0) state.bag = newBag();
      state.queue.push(state.bag.pop());
    }
  }

  function spawnPiece() {
    ensureQueue(5);
    const type = state.queue.shift();
    const piece = { type, x: 3, y: 0, r: 0 };
    if (collides(piece, state.board, 0, 0, 0)) {
      state.running = false; renderBoard(); drawGameOver(); return;
    }
    state.current = piece;
    state.holdUsed = false;
    ensureQueue(5);
    renderNext();
  }

  function cellsFor(piece) {
    const shape = SHAPES[piece.type][piece.r];
    return shape.map(([dx, dy]) => [piece.x + dx, piece.y + dy]);
  }

  function collides(piece, board, offX, offY, rotDelta) {
    const r = (piece.r + rotDelta + 4) % 4;
    const shape = SHAPES[piece.type][r];
    for (const [dx, dy] of shape) {
      const x = piece.x + dx + offX;
      const y = piece.y + dy + offY;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x]) return true;
    }
    return false;
  }

  function lockPiece() {
    for (const [x, y] of cellsFor(state.current)) {
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) state.board[y][x] = state.current.type;
    }
    const cleared = sweepLines();
    if (cleared > 0) addScoreForLines(cleared);
    spawnPiece();
  }

  function sweepLines() {
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (state.board[y].every(Boolean)) {
        const row = state.board.splice(y, 1)[0];
        row.fill(0);
        state.board.unshift(row);
        cleared++; y++;
      }
    }
    state.lines += cleared;
    updateLevel();
    return cleared;
  }

  function addScoreForLines(count) {
    const table = { 1: 100, 2: 300, 3: 500, 4: 800 };
    state.score += (table[count] || 0) * state.level;
  }

  function updateLevel() {
    state.level = Math.floor(state.lines / 10) + 1;
    state.dropIntervalMs = Math.max(80, 1000 - (state.level - 1) * 70);
  }

  function move(dx, dy) {
    if (!state.current) return false;
    if (!collides(state.current, state.board, dx, dy, 0)) { state.current.x += dx; state.current.y += dy; return true; }
    return false;
  }

  function hardDrop() {
    if (!state.current) return;
    let distance = 0;
    while (!collides(state.current, state.board, 0, 1, 0)) { state.current.y++; distance++; }
    state.score += distance * 2;
    lockPiece();
  }

  function rotate(dir) {
    if (!state.current) return;
    const from = state.current.r;
    const to = (from + (dir > 0 ? 1 : -1) + 4) % 4;
    const piece = state.current.type;
    const key = `${from}>${to}`;
    const kicks = (piece === 'I' ? KICKS.I : KICKS.default)[key] || [[0,0]];
    for (const [kx, ky] of kicks) {
      if (!collides({ ...state.current, r: to }, state.board, kx, ky, 0)) { state.current.x += kx; state.current.y += ky; state.current.r = to; return; }
    }
  }

  function hold() {
    if (!state.current || state.holdUsed) return;
    const cur = state.current; const temp = state.held; state.held = { type: cur.type };
    if (temp) { state.current = { type: temp.type, x: 3, y: 0, r: 0 }; if (collides(state.current, state.board, 0, 0, 0)) { state.running = false; drawGameOver(); } }
    else { spawnPiece(); }
    state.holdUsed = true; renderHold();
  }

  function ghostY() {
    if (!state.current) return 0;
    let y = state.current.y;
    while (!collides(state.current, state.board, 0, y - state.current.y + 1, 0)) y++;
    return y;
  }

  function renderBoard() {
    boardCtx.clearRect(0,0,BOARD_W,BOARD_H);
    boardCtx.fillStyle = '#0a0d22';
    boardCtx.fillRect(0,0,BOARD_W,BOARD_H);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cell = state.board[y][x];
        if (cell) drawCell(boardCtx, x, y, COLORS[cell]);
        else { boardCtx.strokeStyle = 'rgba(255,255,255,0.03)'; boardCtx.strokeRect(x*CELL_SIZE, y*CELL_SIZE, CELL_SIZE, CELL_SIZE); }
      }
    }
    if (state.current) {
      const savedY = state.current.y; const gY = ghostY();
      for (const [x, y] of cellsFor(state.current)) { const yy = y + (gY - savedY); if (yy >= 0) drawCell(boardCtx, x, yy, 'rgba(255,255,255,0.08)'); }
      for (const [x, y] of cellsFor(state.current)) { if (y >= 0) drawCell(boardCtx, x, y, COLORS[state.current.type]); }
    }
    scoreEl.textContent = String(state.score);
    levelEl.textContent = String(state.level);
    linesEl.textContent = String(state.lines);
  }

  function clearMini(ctx) { ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height); ctx.fillStyle = '#0a0d22'; ctx.fillRect(0,0,ctx.canvas.width, ctx.canvas.height); }

  function renderNext() {
    clearMini(nextCtx);
    const preview = state.queue.slice(0, 3);
    const cell = 20;
    preview.forEach((type, i) => {
      const shape = SHAPES[type][0]; const offsetX = 10; const offsetY = 10 + i * 36;
      for (const [x, y] of shape) {
        nextCtx.fillStyle = COLORS[type]; nextCtx.fillRect(offsetX + x*cell, offsetY + y*cell, cell, cell);
        nextCtx.strokeStyle = 'rgba(255,255,255,0.08)'; nextCtx.lineWidth = 2; nextCtx.strokeRect(offsetX + x*cell + 1, offsetY + y*cell + 1, cell - 2, cell - 2);
      }
    });
  }

  function renderHold() {
    clearMini(holdCtx);
    if (!state.held) return;
    const cell = 20; const type = state.held.type; const shape = SHAPES[type][0]; const offsetX = 10; const offsetY = 20;
    for (const [x, y] of shape) {
      holdCtx.fillStyle = COLORS[type]; holdCtx.fillRect(offsetX + x*cell, offsetY + y*cell, cell, cell);
      holdCtx.strokeStyle = 'rgba(255,255,255,0.08)'; holdCtx.lineWidth = 2; holdCtx.strokeRect(offsetX + x*cell + 1, offsetY + y*cell + 1, cell - 2, cell - 2);
    }
  }

  function drawGameOver() {
    boardCtx.fillStyle = 'rgba(0,0,0,0.6)'; boardCtx.fillRect(0,0,BOARD_W,BOARD_H);
    boardCtx.fillStyle = '#fff'; boardCtx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'; boardCtx.textAlign = 'center';
    boardCtx.fillText('Game Over', BOARD_W/2, BOARD_H/2 - 10);
    boardCtx.font = '16px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'; boardCtx.fillText('Press Restart', BOARD_W/2, BOARD_H/2 + 18);
  }

  function update(time) {
    if (!state.running || state.paused) { renderBoard(); return; }
    const delta = time - state.lastTime; state.lastTime = time; state.dropTimer += delta;
    if (state.dropTimer >= state.dropIntervalMs) { state.dropTimer = 0; if (!move(0,1)) { lockPiece(); } }
    renderBoard(); requestAnimationFrame(update);
  }

  function startGame() {
    resetBoard(); state.score = 0; state.level = 1; state.lines = 0; state.dropIntervalMs = 1000; state.bag = []; state.queue = []; state.held = null; state.holdUsed = false;
    spawnPiece(); renderHold(); renderNext(); state.running = true; state.paused = false; state.lastTime = performance.now(); state.dropTimer = 0; requestAnimationFrame(update);
  }

  function togglePause() {
    if (!state.running) return; state.paused = !state.paused; if (!state.paused) { state.lastTime = performance.now(); requestAnimationFrame(update); } else { boardCtx.fillStyle = 'rgba(0,0,0,0.5)'; boardCtx.fillRect(0,0,BOARD_W,BOARD_H); boardCtx.fillStyle = '#fff'; boardCtx.font = 'bold 24px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif'; boardCtx.textAlign = 'center'; boardCtx.fillText('Paused', BOARD_W/2, BOARD_H/2); }
  }

  function restartGame() { startGame(); }

  const keys = new Set(); let dasTimer = 0; let arrTimer = 0;

  function handleKeyDown(e) {
    const key = e.key.toLowerCase();
    if (['arrowleft','arrowright','arrowdown',' ','x','z','c','shift','p','arrowup'].includes(key)) e.preventDefault();
    if (!state.running) return;
    if (key === 'p') { togglePause(); return; }
    if (state.paused) return;
    switch (key) {
      case 'arrowleft': if (move(-1, 0)) { dasTimer = 170; arrTimer = 0; } keys.add('left'); break;
      case 'arrowright': if (move(1, 0)) { dasTimer = 170; arrTimer = 0; } keys.add('right'); break;
      case 'arrowdown': if (move(0, 1)) state.score += 1; break;
      case 'x': case 'arrowup': rotate(1); break;
      case 'z': rotate(-1); break;
      case 'c': case 'shift': hold(); break;
      case ' ': hardDrop(); break;
    }
    renderBoard();
  }

  function handleKeyUp(e) {
    const key = e.key.toLowerCase(); if (key === 'arrowleft') keys.delete('left'); if (key === 'arrowright') keys.delete('right');
  }

  function inputLoop() {
    if (!state.running || state.paused) { setTimeout(() => requestAnimationFrame(inputLoop), 60); return; }
    if (keys.has('left') || keys.has('right')) {
      const dir = keys.has('left') ? -1 : 1;
      if (dasTimer > 0) { dasTimer -= 16; }
      else { arrTimer -= 16; if (arrTimer <= 0) { if (move(dir, 0)) { arrTimer = 40; } else { arrTimer = 40; } } }
    } else { dasTimer = 0; arrTimer = 0; }
    renderBoard(); setTimeout(() => requestAnimationFrame(inputLoop), 16);
  }

  function setupTouch() {
    let touchStart = null;
    boardCanvas.addEventListener('touchstart', (e) => {
      if (!state.running) return; const t = e.changedTouches[0]; touchStart = { x: t.clientX, y: t.clientY, time: performance.now() };
      const rect = boardCanvas.getBoundingClientRect(); const relX = t.clientX - rect.left; const relY = t.clientY - rect.top;
      if (relY < rect.height * 0.33) rotate(1); else if (relX < rect.width * 0.5) move(-1, 0); else move(1, 0);
      renderBoard();
    }, { passive: true });
    boardCanvas.addEventListener('touchend', (e) => {
      if (!state.running || !touchStart) return; const t = e.changedTouches[0]; const dy = t.clientY - touchStart.y; const dx = t.clientX - touchStart.x; const dt = performance.now() - touchStart.time;
      if (dt < 300 && Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx)) { if (dy > 0) hardDrop(); }
      touchStart = null;
    }, { passive: true });
  }

  startBtn.addEventListener('click', () => { if (!state.running) startGame(); });
  pauseBtn.addEventListener('click', togglePause);
  restartBtn.addEventListener('click', restartGame);

  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp, { passive: false });

  clearMini(nextCtx); clearMini(holdCtx); renderBoard(); setupTouch(); requestAnimationFrame(inputLoop);
})();
