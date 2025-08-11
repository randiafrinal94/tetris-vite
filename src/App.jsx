import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ---------------------- Helpers & constants ---------------------- */

const COLS = 10;
const ROWS = 20;
const VISIBLE_ROWS = 20;
const INITIAL_DROP_MS = 800;
const SPEEDUP_PER_LEVEL = 60;
const LINES_PER_LEVEL = 10;

// hex -> rgba untuk glow
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Tetromino
const TETROMINOES = {
  I: { color: "#22d3ee", shapes: [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
  ]},
  J: { color: "#60a5fa", shapes: [
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,1,1],[0,1,0],[0,1,0]],
    [[0,0,0],[1,1,1],[0,0,1]],
    [[0,1,0],[0,1,0],[1,1,0]],
  ]},
  L: { color: "#fb923c", shapes: [
    [[0,0,1],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,0],[0,1,1]],
    [[0,0,0],[1,1,1],[1,0,0]],
    [[1,1,0],[0,1,0],[0,1,0]],
  ]},
  O: { color: "#fde047", shapes: [
    [[1,1],[1,1]],
  ]},
  S: { color: "#34d399", shapes: [
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[0,1,1],[0,0,1]],
  ]},
  T: { color: "#a78bfa", shapes: [
    [[0,1,0],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,0],[0,1,0]],
  ]},
  Z: { color: "#f472b6", shapes: [
    [[1,1,0],[0,1,1],[0,0,0]],
    [[0,0,1],[0,1,1],[0,1,0]],
  ]},
};
const TYPES = Object.keys(TETROMINOES);

const emptyBoard = (rows=ROWS, cols=COLS) =>
  Array.from({ length: rows }, () => Array(cols).fill(null));

const getRandomType = () => TYPES[Math.floor(Math.random()*TYPES.length)];

const rotateShape = (type, rot) => {
  const shapes = TETROMINOES[type].shapes;
  const idx = ((rot % shapes.length) + shapes.length) % shapes.length;
  return shapes[idx];
};

const canPlace = (board, shape, pos) => {
  const { x, y } = pos;
  for (let r=0;r<shape.length;r++){
    for (let c=0;c<shape[r].length;c++){
      if (!shape[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && board[ny][nx]) return false;
    }
  }
  return true;
};

const mergePiece = (board, shape, pos, color) => {
  const newBoard = board.map(row => row.slice());
  for (let r=0;r<shape.length;r++){
    for (let c=0;c<shape[r].length;c++){
      if (!shape[r][c]) continue;
      const nx = pos.x + c, ny = pos.y + r;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) newBoard[ny][nx] = color;
    }
  }
  return newBoard;
};

const clearLines = (board) => {
  const nb = []; let cleared = 0;
  for (let r=0;r<ROWS;r++){
    if (board[r].every(cell => cell)) cleared++;
    else nb.push(board[r]);
  }
  while (nb.length < ROWS) nb.unshift(Array(COLS).fill(null));
  return { board: nb, cleared };
};

const scoreFor = (lines) => [0,100,300,500,800][lines] || 0;
const isTopReached = (board) => board[0].some(Boolean);

/* ---------------------- Small components ---------------------- */

function NextPreview({ type }) {
  const shape = type ? rotateShape(type, 0) : null;
  return (
    <div className="p-3 bg-slate-800/70 rounded-2xl shadow-inner min-h-28 flex items-center justify-center border border-white/10 backdrop-blur">
      {shape ? (
        <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${shape[0].length}, 1rem)` }}>
          {shape.flatMap((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className="w-4 h-4 m-[2px] rounded-sm"
                style={{
                  background: cell ? TETROMINOES[type].color : "transparent",
                  boxShadow: cell ? "inset 0 -2px 0 rgba(0,0,0,0.25)" : "none",
                }}
              />
            ))
          )}
        </div>
      ) : <div className="text-slate-400 text-sm">—</div>}
    </div>
  );
}

function MobileControls({ onLeft, onRight, onDown, onRotate, onDrop, onHold, onPause }) {
  return (
    <div className="fixed bottom-3 left-0 right-0 md:hidden z-50 pointer-events-none">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex justify-between gap-3">
          {/* Joystick kiri */}
          <div className="pointer-events-auto flex gap-2">
            <button onClick={onLeft}  className="p-4 rounded-full bg-slate-800/85 border border-white/15 shadow-xl text-white text-lg active:scale-95">⬅️</button>
            <button onClick={onDown}  className="p-4 rounded-full bg-slate-800/85 border border-white/15 shadow-xl text-white text-lg active:scale-95">⬇️</button>
            <button onClick={onRight} className="p-4 rounded-full bg-slate-800/85 border border-white/15 shadow-xl text-white text-lg active:scale-95">➡️</button>
          </div>
          {/* Tombol aksi kanan */}
          <div className="pointer-events-auto grid grid-cols-2 gap-2 max-w-[180px]">
            <button onClick={onRotate} className="px-4 h-12 rounded-xl bg-emerald-500 text-slate-900 font-bold shadow-xl active:scale-95">⟳</button>
            <button onClick={onDrop}   className="px-4 h-12 rounded-xl bg-cyan-400 text-slate-900 font-bold shadow-xl active:scale-95">⏬</button>
            <button onClick={onHold}   className="px-4 h-12 rounded-xl bg-yellow-400 text-slate-900 font-bold shadow-xl active:scale-95">H</button>
            <button onClick={onPause}  className="px-4 h-12 rounded-xl bg-red-500 text-slate-900 font-bold shadow-xl active:scale-95">⏸</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Main game ---------------------- */

export default function Tetris() {
  const [board, setBoard] = useState(() => emptyBoard());
  const [curr, setCurr] = useState(() => ({ type: getRandomType(), rot: 0, pos: { x: 3, y: -2 } }));
  const [nextType, setNextType] = useState(() => getRandomType());
  const [holdType, setHoldType] = useState(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [running, setRunning] = useState(true);
  const [gameOver, setGameOver] = useState(false);

  const dropSpeed = Math.max(120, INITIAL_DROP_MS - (level - 1) * SPEEDUP_PER_LEVEL);

  // responsive cell size
  const [cell, setCell] = useState(typeof window !== "undefined" && window.innerWidth < 768 ? 22 : 26);
  useEffect(() => {
    const onResize = () => setCell(window.innerWidth < 768 ? 22 : 26);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const shape = useMemo(() => rotateShape(curr.type, curr.rot), [curr]);

  // spawn piece
  const spawn = useCallback((type) => {
    const pos = { x: Math.floor(COLS/2) - 2, y: -2 };
    const newShape = rotateShape(type, 0);
    if (!canPlace(board, newShape, pos)) {
      setGameOver(true); setRunning(false);
      return null;
    }
    setCurr({ type, rot: 0, pos });
    setCanHold(true);
    return true;
  }, [board]);

  // hard drop
  const hardDrop = useCallback(() => {
    if (gameOver || !running) return;
    let y = curr.pos.y;
    while (canPlace(board, shape, { x: curr.pos.x, y: y + 1 })) y++;
    const merged = mergePiece(board, shape, { x: curr.pos.x, y }, TETROMINOES[curr.type].color);
    const { board: clearedBoard, cleared } = clearLines(merged);
    if (isTopReached(clearedBoard)) { setBoard(clearedBoard); setGameOver(true); setRunning(false); return; }
    if (cleared) { setScore(s => s + scoreFor(cleared) * level); setLines(ln => ln + cleared); }
    if ((lines + cleared) >= level * LINES_PER_LEVEL) setLevel(lv => lv + 1);
    setBoard(clearedBoard);
    const next = nextType;
    setNextType(getRandomType());
    spawn(next);
  }, [board, curr, gameOver, running, shape, level, lines, nextType, spawn]);

  // auto drop (RAF)
  const lastRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    if (!running || gameOver) return;
    const step = (ts) => {
      if (lastRef.current == null) lastRef.current = ts;
      const diff = ts - lastRef.current;
      if (diff >= dropSpeed) {
        // try move down else lock
        const np = { x: curr.pos.x, y: curr.pos.y + 1 };
        if (canPlace(board, shape, np)) {
          setCurr(p => ({ ...p, pos: np }));
        } else {
          const merged = mergePiece(board, shape, curr.pos, TETROMINOES[curr.type].color);
          const { board: clearedBoard, cleared } = clearLines(merged);
          if (isTopReached(clearedBoard)) { setBoard(clearedBoard); setGameOver(true); setRunning(false); lastRef.current = ts; rafRef.current = requestAnimationFrame(step); return; }
          if (cleared) { setScore(s => s + scoreFor(cleared) * level); setLines(ln => ln + cleared); }
          if ((lines + cleared) >= level * LINES_PER_LEVEL) setLevel(lv => lv + 1);
          setBoard(clearedBoard);
          const next = nextType;
          setNextType(getRandomType());
          spawn(next);
        }
        lastRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastRef.current = null; };
  }, [running, gameOver, dropSpeed, board, shape, curr, level, lines, nextType, spawn]);

  /* ---------------------- Controls ---------------------- */
  const moveLeft = () => {
    const np = { x: curr.pos.x - 1, y: curr.pos.y };
    if (!gameOver && running && canPlace(board, shape, np)) setCurr(p => ({ ...p, pos: np }));
  };
  const moveRight = () => {
    const np = { x: curr.pos.x + 1, y: curr.pos.y };
    if (!gameOver && running && canPlace(board, shape, np)) setCurr(p => ({ ...p, pos: np }));
  };
  const softDrop = () => {
    const np = { x: curr.pos.x, y: curr.pos.y + 1 };
    if (!gameOver && running && canPlace(board, shape, np)) setCurr(p => ({ ...p, pos: np }));
  };
  const rotateCW = () => {
    const newRot = curr.rot + 1;
    const newShape = rotateShape(curr.type, newRot);
    for (const k of [0,-1,1,-2,2]) {
      const test = { x: curr.pos.x + k, y: curr.pos.y };
      if (canPlace(board, newShape, test)) { setCurr(p => ({ ...p, rot: newRot, pos: test })); break; }
    }
  };
  const holdSwap = () => {
    if (!canHold || gameOver || !running) return;
    setCanHold(false);
    if (holdType == null) {
      setHoldType(curr.type);
      spawn(nextType);
      setNextType(getRandomType());
    } else {
      const swap = holdType; setHoldType(curr.type); spawn(swap);
    }
  };
  const togglePause = () => setRunning(r => !r);

  // keyboard (desktop)
  useEffect(() => {
    const onKey = (e) => {
      if (gameOver) return;
      if (e.code === "KeyP") { togglePause(); return; }
      if (!running) return;
      if (["ArrowLeft","ArrowRight","ArrowDown","ArrowUp","Space","KeyZ","KeyX","KeyC"].includes(e.code)) e.preventDefault();
      if (e.code === "ArrowLeft") moveLeft();
      if (e.code === "ArrowRight") moveRight();
      if (e.code === "ArrowDown") softDrop();
      if (e.code === "ArrowUp" || e.code === "KeyX") rotateCW();
      if (e.code === "Space") hardDrop();
      if (e.code === "KeyC") holdSwap();
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [moveLeft, moveRight, softDrop, rotateCW, hardDrop, holdSwap, running, gameOver]);

  // gesture (tap=rotate, swipe=move)
  const touchRef = useRef({ x: 0, y: 0, moved: false });
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, moved: false };
  };
  const onTouchMove  = (e) => {
    if (!running || gameOver) return;
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.abs(dx) > 24) {
      touchRef.current.moved = true;
      if (dx > 0) moveRight(); else moveLeft();
      touchRef.current.x = t.clientX;
    }
    if (Math.abs(dy) > 28) {
      touchRef.current.moved = true;
      if (dy > 0) softDrop();
      touchRef.current.y = t.clientY;
    }
  };
  const onTouchEnd   = () => {
    if (!running || gameOver) return;
    if (!touchRef.current.moved) rotateCW();
  };

  const reset = () => {
    setBoard(emptyBoard());
    setCurr({ type: getRandomType(), rot: 0, pos: { x: 3, y: -2 } });
    setNextType(getRandomType());
    setHoldType(null);
    setScore(0); setLevel(1); setLines(0);
    setRunning(true); setGameOver(false);
  };

  const ghostY = useMemo(() => {
    let y = curr.pos.y;
    while (canPlace(board, shape, { x: curr.pos.x, y: y + 1 })) y++;
    return y;
  }, [board, shape, curr]);

  /* ---------------------- Render ---------------------- */

  return (
    <div className="min-h-[600px] w-full flex items-start justify-center p-5 md:p-6 pb-40 md:pb-6 text-slate-100 bg-[radial-gradient(80%_100%_at_10%_10%,#0ea5e930,transparent),radial-gradient(60%_80%_at_90%_10%,#a78bfa30,transparent),linear-gradient(to_br,#0b1220,#0f172a)]">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(240px,1fr)_260px] gap-4 md:gap-6 w-full max-w-5xl">
        {/* Board side */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xl font-bold tracking-tight">Tetris</div>
              <div className="text-sm text-slate-300">by you ✨</div>
            </div>
          </div>

          <div
            className="relative rounded-3xl p-3 bg-slate-900/60 shadow-2xl backdrop-blur-xl border border-white/10 ring-1 ring-white/5"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${COLS}, ${cell}px)`, gridAutoRows: `${cell}px` }}
            >
              {Array.from({ length: VISIBLE_ROWS }).map((_, r) => (
                <React.Fragment key={r}>
                  {Array.from({ length: COLS }).map((_, c) => {
                    const by = r - (VISIBLE_ROWS - ROWS);
                    const cellColor = board[by]?.[c] || null;

                    // active piece cell?
                    let active = false, activeColor = null;
                    if (shape) {
                      const pr = r - (curr.pos.y >= 0 ? curr.pos.y : 0);
                      const pc = c - curr.pos.x;
                      if (pr >= 0 && pc >= 0 && shape[pr] && shape[pr][pc]) {
                        const ay = curr.pos.y + pr;
                        if (ay === by) { active = true; activeColor = TETROMINOES[curr.type].color; }
                      }
                    }

                    // ghost cell?
                    let ghost = false;
                    if (shape) {
                      const pr = r - (ghostY >= 0 ? ghostY : 0);
                      const pc = c - curr.pos.x;
                      if (pr >= 0 && pc >= 0 && shape[pr] && shape[pr][pc]) {
                        const gy = ghostY + pr;
                        if (gy === by && !cellColor && !active) ghost = true;
                      }
                    }

                    // Neon style
                    const col = active ? activeColor : (cellColor || null);
                    const style = col
                      ? {
                          width: cell, height: cell,
                          background: `linear-gradient(145deg, ${col} 35%, rgba(255,255,255,0.18))`,
                          boxShadow: `0 2px 8px ${hexToRgba(col,0.35)}, 0 0 18px ${hexToRgba(col,0.25)}, inset 0 -3px 0 rgba(0,0,0,0.28)`,
                          border: "1px solid rgba(255,255,255,0.14)", borderRadius: "8px",
                        }
                      : ghost
                      ? { width: cell, height: cell, background: "rgba(255,255,255,0.07)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }
                      : { width: cell, height: cell, background: "rgba(15,23,42,0.55)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px" };

                    return (
                      <motion.div
                        layout
                        key={`${r}-${c}`}
                        style={style}
                        initial={{ scale: 0.95, opacity: 0.9 }}
                        animate={active ? { scale: [0.97, 1, 0.97] } : { scale: 1 }}
                        transition={{ duration: active ? 1.2 : 0.08, repeat: active ? Infinity : 0, ease: "easeInOut" }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Overlays */}
            <AnimatePresence>
              {!running && !gameOver && (
                <motion.div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="text-center">
                    <div className="text-xl font-semibold mb-2">Paused</div>
                    <div className="text-sm text-slate-300">Tap ⏸ or press P to resume</div>
                  </div>
                </motion.div>
              )}
              {gameOver && (
                <motion.div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">Game Over</div>
                    <div className="text-sm text-slate-300 mb-4">Score: {score}</div>
                    <button onClick={reset} className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-semibold shadow hover:brightness-110 active:brightness-95">Play Again</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Hint keyboard (desktop only) */}
          <div className="mt-3 hidden md:block text-xs text-slate-300">
            ⌨️ <b>Arrows</b> move • <b>↑/X</b> rotate • <b>Z</b> ccw • <b>Space</b> hard drop • <b>C</b> hold • <b>P</b> pause
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3 md:sticky md:top-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-800/70 rounded-2xl shadow-xl border border-white/10 backdrop-blur-xl">
              <div className="text-xs text-slate-400">Score</div>
              <div className="text-2xl font-bold">{score}</div>
            </div>
            <div className="p-3 bg-slate-800/70 rounded-2xl shadow-xl border border-white/10 backdrop-blur-xl">
              <div className="text-xs text-slate-400">Level</div>
              <div className="text-2xl font-bold">{level}</div>
            </div>
            <div className="p-3 bg-slate-800/70 rounded-2xl shadow-xl border border-white/10 backdrop-blur-xl">
              <div className="text-xs text-slate-400">Lines</div>
              <div className="text-2xl font-bold">{lines}</div>
            </div>
          </div>

          <div className="p-3 bg-slate-800/70 rounded-2xl shadow-xl border border-white/10 backdrop-blur-xl">
            <div className="text-xs text-slate-400 mb-2">Next</div>
            <NextPreview type={nextType} />
          </div>

          <div className="p-3 bg-slate-800/70 rounded-2xl shadow-xl border border-white/10 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 mb-2">Hold</div>
                <NextPreview type={holdType} />
              </div>
              <button onClick={togglePause} className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-medium">
                {running ? "Pause" : "Resume"}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-semibold shadow hover:brightness-110 active:brightness-95">New Game</button>
            <button onClick={hardDrop} className="flex-1 px-4 py-2 rounded-xl bg-cyan-400 text-slate-900 font-semibold shadow hover:brightness-110 active:brightness-95">Hard Drop</button>
          </div>
        </div>
      </div>

      {/* Mobile on-screen controls */}
      <MobileControls
        onLeft={moveLeft}
        onRight={moveRight}
        onDown={softDrop}
        onRotate={rotateCW}
        onDrop={hardDrop}
        onHold={holdSwap}
        onPause={togglePause}
      />
    </div>
  );
}