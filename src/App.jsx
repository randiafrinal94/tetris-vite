import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLS = 10;
const ROWS = 20;
const VISIBLE_ROWS = 20;
const INITIAL_DROP_MS = 800;
const SPEEDUP_PER_LEVEL = 60;
const LINES_PER_LEVEL = 10;

const TETROMINOES = {
  I: {
    color: "#22d3ee",
    shapes: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
      ],
    ],
  },
  J: {
    color: "#60a5fa",
    shapes: [
      [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 1],
        [0, 1, 0],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 0, 1],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0],
      ],
    ],
  },
  L: {
    color: "#fb923c",
    shapes: [
      [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [1, 0, 0],
      ],
      [
        [1, 1, 0],
        [0, 1, 0],
        [0, 1, 0],
      ],
    ],
  },
  O: {
    color: "#fde047",
    shapes: [
      [
        [1, 1],
        [1, 1],
      ],
    ],
  },
  S: {
    color: "#34d399",
    shapes: [
      [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 0, 1],
      ],
    ],
  },
  T: {
    color: "#a78bfa",
    shapes: [
      [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 1, 0],
        [0, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
    ],
  },
  Z: {
    color: "#f472b6",
    shapes: [
      [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
      ],
      [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
    ],
  },
};

const TYPES = Object.keys(TETROMINOES);

function emptyBoard(rows = ROWS, cols = COLS) {
  return Array.from({ length: rows }, () => Array(cols).fill(null));
}

function getRandomType() {
  return TYPES[Math.floor(Math.random() * TYPES.length)];
}

function rotateShape(type, rotation) {
  const shapes = TETROMINOES[type].shapes;
  const idx = ((rotation % shapes.length) + shapes.length) % shapes.length;
  return shapes[idx];
}

function canPlace(board, shape, pos) {
  const { x, y } = pos;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
      if (ny >= 0 && board[ny][nx]) return false;
    }
  }
  return true;
}

function mergePiece(board, shape, pos, color) {
  const newBoard = board.map((row) => row.slice());
  const { x, y } = pos;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        newBoard[ny][nx] = color;
      }
    }
  }
  return newBoard;
}

function clearLines(board) {
  const newBoard = [];
  let cleared = 0;
  for (let r = 0; r < ROWS; r++) {
    if (board[r].every((cell) => cell)) {
      cleared++;
    } else {
      newBoard.push(board[r]);
    }
  }
  while (newBoard.length < ROWS) newBoard.unshift(Array(COLS).fill(null));
  return { board: newBoard, cleared };
}

function scoreFor(lines) {
  switch (lines) {
    case 1: return 100;
    case 2: return 300;
    case 3: return 500;
    case 4: return 800;
    default: return 0;
  }
}

function useRafInterval(callback, delayMs, running) {
  const lastRef = useRef(null);
  const rafRef = useRef(null);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!running) return;
    function tick(ts) {
      if (lastRef.current == null) lastRef.current = ts;
      const diff = ts - lastRef.current;
      if (diff >= delayMs) {
        cbRef.current();
        lastRef.current = ts;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [delayMs, running]);
}

function NextPreview({ type }) {
  const shape = type ? rotateShape(type, 0) : null;
  return (
    <div className="p-3 bg-slate-800 rounded-2xl shadow-inner min-h-28 flex items-center justify-center">
      {shape ? (
        <div className="inline-grid" style={{ gridTemplateColumns: `repeat(${shape[0].length}, 1rem)` }}>
          {shape.flatMap((row, r) =>
            row.map((cell, c) => (
              <div
                key={`${r}-${c}`}
                className="w-4 h-4 m-[2px] rounded-sm"
                style={{ background: cell ? TETROMINOES[type].color : "transparent", boxShadow: cell ? "inset 0 -2px 0 rgba(0,0,0,0.25)" : "none" }}
              />
            ))
          )}
        </div>
      ) : (
        <div className="text-slate-400 text-sm">—</div>
      )}
    </div>
  );
}

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

  const shape = useMemo(() => rotateShape(curr.type, curr.rot), [curr]);

  const spawn = useCallback((type) => {
    const startPos = { x: Math.floor(COLS / 2) - 2, y: -2 };
    const newPiece = { type, rot: 0, pos: startPos };
    const newShape = rotateShape(type, 0);
    if (!canPlace(board, newShape, startPos)) {
      setGameOver(true);
      setRunning(false);
      return null;
    }
    setCurr(newPiece);
    setCanHold(true);
    return newPiece;
  }, [board]);

  const hardDrop = useCallback(() => {
    if (gameOver || !running) return;
    let y = curr.pos.y;
    while (canPlace(board, shape, { x: curr.pos.x, y: y + 1 })) {
      y++;
    }
    const merged = mergePiece(board, shape, { x: curr.pos.x, y }, TETROMINOES[curr.type].color);
    const { board: clearedBoard, cleared } = clearLines(merged);
    if (cleared) {
      setScore((s) => s + scoreFor(cleared) * level);
      setLines((ln) => ln + cleared);
    }
    if (((lines + cleared) >= level * LINES_PER_LEVEL)) setLevel((lv) => lv + 1);
    setBoard(clearedBoard);
    setCurr({ type: nextType, rot: 0, pos: { x: Math.floor(COLS / 2) - 2, y: -2 } });
    setNextType(getRandomType());
    setCanHold(true);
    const newShape = rotateShape(nextType, 0);
    if (!canPlace(clearedBoard, newShape, { x: Math.floor(COLS / 2) - 2, y: -2 })) {
      setGameOver(true);
      setRunning(false);
    }
  }, [board, curr, gameOver, running, shape, level, lines, nextType]);

  useRafInterval(() => {
    if (gameOver || !running) return;
    const newPos = { x: curr.pos.x, y: curr.pos.y + 1 };
    if (canPlace(board, shape, newPos)) {
      setCurr((p) => ({ ...p, pos: newPos }));
    } else {
      const merged = mergePiece(board, shape, curr.pos, TETROMINOES[curr.type].color);
      const { board: clearedBoard, cleared } = clearLines(merged);
      if (cleared) {
        setScore((s) => s + scoreFor(cleared) * level);
        setLines((ln) => ln + cleared);
      }
      if (((lines + cleared) >= level * LINES_PER_LEVEL)) setLevel((lv) => lv + 1);
      setBoard(clearedBoard);
      const next = { type: nextType, rot: 0, pos: { x: Math.floor(COLS / 2) - 2, y: -2 } };
      setCurr(next);
      setNextType(getRandomType());
      setCanHold(true);
      const newShape = rotateShape(next.type, next.rot);
      if (!canPlace(clearedBoard, newShape, next.pos)) {
        setGameOver(true);
        setRunning(false);
      }
    }
  }, dropSpeed, running);

  useEffect(() => {
    function onKey(e) {
      if (gameOver) return;
      if (e.code === "KeyP") {
        setRunning((r) => !r);
      }
      if (!running) return;
      if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space", "KeyZ", "KeyX", "KeyC"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "ArrowLeft") {
        const newPos = { x: curr.pos.x - 1, y: curr.pos.y };
        if (canPlace(board, shape, newPos)) setCurr((p) => ({ ...p, pos: newPos }));
      }
      if (e.code === "ArrowRight") {
        const newPos = { x: curr.pos.x + 1, y: curr.pos.y };
        if (canPlace(board, shape, newPos)) setCurr((p) => ({ ...p, pos: newPos }));
      }
      if (e.code === "ArrowDown") {
        const newPos = { x: curr.pos.x, y: curr.pos.y + 1 };
        if (canPlace(board, shape, newPos)) setCurr((p) => ({ ...p, pos: newPos }));
      }
      if (e.code === "ArrowUp" || e.code === "KeyX") {
        const newRot = curr.rot + 1;
        const newShape = rotateShape(curr.type, newRot);
        const kicks = [0, -1, 1, -2, 2];
        for (const k of kicks) {
          const testPos = { x: curr.pos.x + k, y: curr.pos.y };
          if (canPlace(board, newShape, testPos)) {
            setCurr((p) => ({ ...p, rot: newRot, pos: testPos }));
            break;
          }
        }
      }
      if (e.code === "KeyZ") {
        const newRot = curr.rot - 1;
        const newShape = rotateShape(curr.type, newRot);
        const kicks = [0, -1, 1, -2, 2];
        for (const k of kicks) {
          const testPos = { x: curr.pos.x + k, y: curr.pos.y };
          if (canPlace(board, newShape, testPos)) {
            setCurr((p) => ({ ...p, rot: newRot, pos: testPos }));
            break;
          }
        }
      }
      if (e.code === "Space") {
        hardDrop();
      }
      if (e.code === "KeyC") {
        if (!canHold) return;
        setCanHold(false);
        if (holdType == null) {
          setHoldType(curr.type);
          spawn(nextType);
          setNextType(getRandomType());
        } else {
          const swap = holdType;
          setHoldType(curr.type);
          spawn(swap);
        }
      }
    }
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [board, curr, shape, hardDrop, running, gameOver, canHold, holdType, nextType, spawn]);

  const reset = () => {
    setBoard(emptyBoard());
    setCurr({ type: getRandomType(), rot: 0, pos: { x: 3, y: -2 } });
    setNextType(getRandomType());
    setHoldType(null);
    setScore(0);
    setLevel(1);
    setLines(0);
    setRunning(true);
    setGameOver(false);
  };

  const ghostY = useMemo(() => {
    let y = curr.pos.y;
    while (canPlace(board, shape, { x: curr.pos.x, y: y + 1 })) y++;
    return y;
  }, [board, shape, curr]);

  const touchRef = useRef({ x: 0, y: 0 });
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e) => {
    if (!running || gameOver) return;
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.abs(dx) > 24) {
      if (dx > 0) {
        const newPos = { x: curr.pos.x + 1, y: curr.pos.y };
        if (canPlace(board, shape, newPos)) setCurr((p) => ({ ...p, pos: newPos }));
      } else {
        const newPos = { x: curr.pos.x - 1, y: curr.pos.y };
        if (canPlace(board, shape, newPos)) setCurr((p) => ({ ...p, pos: newPos }));
      }
      touchRef.current.x = t.clientX;
    }
    if (Math.abs(dy) > 28) {
      if (dy > 0) {
        const newPos = { x: curr.pos.x, y: curr.pos.y + 1 };
        if (canPlace(board, shape, newPos)) setCurr((p) => ({ ...p, pos: newPos }));
      }
      touchRef.current.y = t.clientY;
    }
  };
  const onTouchEnd = () => {
    if (!running || gameOver) return;
    const newRot = curr.rot + 1;
    const newShape = rotateShape(curr.type, newRot);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      const testPos = { x: curr.pos.x + k, y: curr.pos.y };
      if (canPlace(board, newShape, testPos)) {
        setCurr((p) => ({ ...p, rot: newRot, pos: testPos }));
        break;
      }
    }
  };

  return (
    <div className="min-h-[600px] w-full flex items-start justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100">
      <div className="grid grid-cols-[minmax(240px,1fr)_220px] gap-4 w-full max-w-5xl">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xl font-bold tracking-tight">Tetris</div>
              <div className="text-sm text-slate-300">by you ✨</div>
            </div>
          </div>

          <div className="relative rounded-2xl p-2 bg-slate-900/70 shadow-2xl backdrop-blur border border-slate-700">
            <div
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${COLS}, 26px)`, gridAutoRows: "26px" }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {Array.from({ length: VISIBLE_ROWS }).map((_, r) => (
                <React.Fragment key={r}>
                  {Array.from({ length: COLS }).map((_, c) => {
                    const by = r - (VISIBLE_ROWS - ROWS);
                    const cellColor = board[by]?.[c] || null;

                    let active = false;
                    let activeColor = null;
                    if (shape) {
                      const pr = r - (curr.pos.y >= 0 ? curr.pos.y : 0);
                      const pc = c - curr.pos.x;
                      if (pr >= 0 && pc >= 0 && shape[pr] && shape[pr][pc]) {
                        const ay = curr.pos.y + pr;
                        if (ay === by) {
                          active = true;
                          activeColor = TETROMINOES[curr.type].color;
                        }
                      }
                    }

                    let ghost = false;
                    if (shape) {
                      const pr = r - (ghostY >= 0 ? ghostY : 0);
                      const pc = c - curr.pos.x;
                      if (pr >= 0 && pc >= 0 && shape[pr] && shape[pr][pc]) {
                        const gy = ghostY + pr;
                        if (gy === by && !cellColor && !active) ghost = true;
                      }
                    }

                    const bg = active
                      ? activeColor
                      : cellColor
                      ? cellColor
                      : ghost
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(15,23,42,0.6)";

                    return (
                      <motion.div
                        layout
                        key={`${r}-${c}`}
                        className="w-[26px] h-[26px] rounded-[6px] border border-slate-700"
                        style={{ background: bg, boxShadow: active || cellColor ? "inset 0 -3px 0 rgba(0,0,0,0.25)" : "none" }}
                        initial={{ scale: 0.9, opacity: 0.6 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.08 }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            <AnimatePresence>
              {!running && !gameOver && (
                <motion.div className="absolute inset-0 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm rounded-2xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="text-center">
                    <div className="text-xl font-semibold mb-2">Paused</div>
                    <div className="text-sm text-slate-300">Press P to resume</div>
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

          <div className="mt-3 text-xs text-slate-300">
            ⌨️ <b>Arrows</b> move • <b>↑/X</b> rotate • <b>Z</b> ccw • <b>Space</b> hard drop • <b>C</b> hold • <b>P</b> pause
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-slate-800 rounded-2xl shadow">
              <div className="text-xs text-slate-400">Score</div>
              <div className="text-2xl font-bold">{score}</div>
            </div>
            <div className="p-3 bg-slate-800 rounded-2xl shadow">
              <div className="text-xs text-slate-400">Level</div>
              <div className="text-2xl font-bold">{level}</div>
            </div>
            <div className="p-3 bg-slate-800 rounded-2xl shadow">
              <div className="text-xs text-slate-400">Lines</div>
              <div className="text-2xl font-bold">{lines}</div>
            </div>
          </div>

          <div className="p-3 bg-slate-800 rounded-2xl shadow">
            <div className="text-xs text-slate-400 mb-2">Next</div>
            <NextPreview type={nextType} />
          </div>

          <div className="p-3 bg-slate-800 rounded-2xl shadow">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400 mb-2">Hold</div>
                <NextPreview type={holdType} />
              </div>
              <button onClick={() => setRunning((r) => !r)} className="px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-medium">
                {running ? "Pause" : "Resume"}
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 text-slate-900 font-semibold shadow hover:brightness-110 active:brightness-95">New Game</button>
            <button onClick={() => hardDrop()} className="flex-1 px-4 py-2 rounded-xl bg-cyan-400 text-slate-900 font-semibold shadow hover:brightness-110 active:brightness-95">Hard Drop</button>
          </div>

          <div className="text-[11px] text-slate-400 leading-relaxed">
            Tip: you can tap/drag on mobile — tap to rotate, drag left/right to move, drag down to soft-drop.
          </div>
        </div>
      </div>
    </div>
  );
}
