"use client";

import { useState, useEffect } from "react";

interface Props {
  count: number;
  size?: number;
  dark?: boolean;
}

export default function RedCardSquare({ count, size = 40, dark = false }: Props) {
  const pad = size * 0.15;
  const s = size - pad * 2;
  const strokeWidth = Math.max(2, size * 0.07);
  const color = count >= 5 ? "#ef4444" : dark ? "#f87171" : "#dc2626";
  const dimColor = dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  // Bars: top, right, bottom, left sides of the square, then cross
  const bars = [
    // 1: top
    <line key="top" x1={pad} y1={pad} x2={pad + s} y2={pad} />,
    // 2: right
    <line key="right" x1={pad + s} y1={pad} x2={pad + s} y2={pad + s} />,
    // 3: bottom
    <line key="bottom" x1={pad + s} y1={pad + s} x2={pad} y2={pad + s} />,
    // 4: left
    <line key="left" x1={pad} y1={pad + s} x2={pad} y2={pad} />,
    // 5: cross (X shape)
    <g key="cross">
      <line x1={pad} y1={pad} x2={pad + s} y2={pad + s} />
      <line x1={pad + s} y1={pad} x2={pad} y2={pad + s} />
    </g>,
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {/* Ghost square outline */}
      <rect
        x={pad}
        y={pad}
        width={s}
        height={s}
        fill="none"
        stroke={dimColor}
        strokeWidth={strokeWidth}
        rx={2}
      />
      {/* Active bars */}
      <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none">
        {bars.slice(0, count)}
      </g>
    </svg>
  );
}

export function RedCardAnimation({ columnName, onDone }: { columnName: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("show"), 50);
    const t2 = setTimeout(() => setPhase("exit"), 3000);
    const t3 = setTimeout(onDone, 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center"
      style={{
        background: phase === "enter" ? "rgba(0,0,0,0)" : "rgba(220,38,38,0.9)",
        transition: "background 0.4s ease-out",
        opacity: phase === "exit" ? 0 : 1,
        transitionProperty: "background, opacity",
        transitionDuration: phase === "exit" ? "0.6s" : "0.4s",
      }}
      onClick={onDone}
    >
      <div
        style={{
          transform: phase === "show" ? "scale(1)" : phase === "enter" ? "scale(0.3)" : "scale(1.2)",
          opacity: phase === "show" ? 1 : 0,
          transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease",
        }}
        className="text-center px-8"
      >
        <div className="text-8xl mb-6">📦</div>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 drop-shadow-lg">
          Direction la déchetterie !
        </h1>
        <p className="text-2xl md:text-3xl font-bold text-red-200">
          {columnName}
        </p>
      </div>
    </div>
  );
}
