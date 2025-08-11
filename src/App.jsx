import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

// helper: hex -> rgba untuk soft glow
function hexToRgba(hex, alpha = 1) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Tombol kontrol untuk mobile
function MobileControls({ onLeft, onRight, onDown, onRotate, onDrop, onHold, onPause }) {
  return (
    <div className="fixed bottom-3 left-0 right-0 flex justify-between px-4 md:hidden z-50">
      {/* Joystick kiri */}
      <div className="flex gap-2">
        <button onClick={onLeft} className="p-4 rounded-full bg-slate-800/80 border border-white/20 shadow-xl text-white text-lg">⬅️</button>
        <button onClick={onDown} className="p-4 rounded-full bg-slate-800/80 border border-white/20 shadow-xl text-white text-lg">⬇️</button>
        <button onClick={onRight} className="p-4 rounded-full bg-slate-800/80 border border-white/20 shadow-xl text-white text-lg">➡️</button>
      </div>
      {/* Tombol aksi kanan */}
      <div className="flex gap-2 flex-wrap justify-end max-w-[160px]">
        <button onClick={onRotate} className="flex-1 p-3 rounded-lg bg-emerald-500 text-slate-900 font-bold shadow-xl">⟳</button>
        <button onClick={onDrop} className="flex-1 p-3 rounded-lg bg-cyan-400 text-slate-900 font-bold shadow-xl">⏬</button>
        <button onClick={onHold} className="flex-1 p-3 rounded-lg bg-yellow-400 text-slate-900 font-bold shadow-xl">H</button>
        <button onClick={onPause} className="flex-1 p-3 rounded-lg bg-red-500 text-slate-900 font-bold shadow-xl">⏸</button>
      </div>
    </div>
  );
}

export default function App() {
  const ROWS = 20;
  const COLS = 10;

  const [board, setBoard] = useState(Array.from({ length: ROWS }, () => Array(COLS).fill(null)));
  const [running, setRunning] = useState(false);
  const [cell, setCell] = useState(typeof window !== "undefined" && window.innerWidth < 768 ? 22 : 26);

  // Gesture tracking
  const touchRef = useRef({ x: 0, y: 0, moved: false });

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, moved: false };
  };

  const onTouchMove = (e) => {
    const t = e.touches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    if (Math.abs(dx) > 24) {
      touchRef.current.moved = true;
      if (dx > 0) moveRight();
      else moveLeft();
      touchRef.current.x = t.clientX;
    }
    if (Math.abs(dy) > 28) {
      touchRef.current.moved = true;
      if (dy > 0) softDrop();
      touchRef.current.y = t.clientY;
    }
  };

  const onTouchEnd = () => {
    if (!touchRef.current.moved) {
      rotatePiece();
    }
  };

  useEffect(() => {
    function onResize() { setCell(window.innerWidth < 768 ? 22 : 26); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Placeholder movement functions (ganti dengan logic game kamu)
  const moveLeft = () => console.log("Move left");
  const moveRight = () => console.log("Move right");
  const softDrop = () => console.log("Soft drop");
  const rotatePiece = () => console.log("Rotate");
  const hardDrop = () => console.log("Hard drop");
  const holdPiece = () => console.log("Hold");
  const togglePause = () => setRunning(r => !r);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <div
        className="relative rounded-2xl bg-slate-900/60 shadow-2xl p-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, ${cell}px)`, gridAutoRows: `${cell}px` }}
        >
          {board.map((row, r) =>
            row.map((col, c) => {
              const colr = col || "#0ea5e9"; // fallback color
              const style = {
                width: cell,
                height: cell,
                background: `linear-gradient(145deg, ${colr} 35%, rgba(255,255,255,0.18))`,
                boxShadow: `0 2px 8px ${hexToRgba(colr, 0.35)}, 0 0 18px ${hexToRgba(colr, 0.25)}, inset 0 -3px 0 rgba(0,0,0,0.28)`,
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: "8px",
              };
              return <motion.div key={r + "-" + c} layout style={style} />;
            })
          )}
        </div>
      </div>

      <MobileControls
        onLeft={moveLeft}
        onRight={moveRight}
        onDown={softDrop}
        onRotate={rotatePiece}
        onDrop={hardDrop}
        onHold={holdPiece}
        onPause={togglePause}
      />
    </div>
  );
}