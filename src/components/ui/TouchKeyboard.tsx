"use client";

import { useState, useCallback } from "react";
import { Keyboard, Delete, CornerDownLeft, Space, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const ROWS_LOWER = [
  ["a", "z", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["q", "s", "d", "f", "g", "h", "j", "k", "l", "m"],
  ["SHIFT", "w", "x", "c", "v", "b", "n", ",", ".", "BACK"],
];

const ROWS_UPPER = [
  ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
  ["SHIFT", "W", "X", "C", "V", "B", "N", ";", ":", "BACK"],
];

const NUM_ROW = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

interface TouchKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onClose: () => void;
}

export default function TouchKeyboard({ value, onChange, onSubmit, onClose }: TouchKeyboardProps) {
  const [shifted, setShifted] = useState(false);

  const rows = shifted ? ROWS_UPPER : ROWS_LOWER;

  const handleKey = useCallback((key: string) => {
    if (key === "SHIFT") {
      setShifted((s) => !s);
      return;
    }
    if (key === "BACK") {
      onChange(value.slice(0, -1));
      return;
    }
    onChange(value + key);
    if (shifted) setShifted(false);
  }, [value, onChange, shifted]);

  return (
    <div
      className="bg-slate-800 border border-slate-600 rounded-xl p-2 shadow-2xl select-none"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {/* Number row */}
      <div className="flex gap-1 mb-1 justify-center">
        {NUM_ROW.map((k) => (
          <button
            key={k}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
            className="flex-1 max-w-[42px] h-10 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white text-sm font-medium transition-colors"
          >
            {k}
          </button>
        ))}
      </div>

      {/* Letter rows */}
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1 mb-1 justify-center">
          {row.map((k) => {
            if (k === "SHIFT") {
              return (
                <button
                  key="shift"
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); handleKey("SHIFT"); }}
                  className={cn(
                    "w-12 h-10 rounded-lg flex items-center justify-center transition-colors",
                    shifted ? "bg-blue-600 text-white" : "bg-slate-600 hover:bg-slate-500 text-slate-300"
                  )}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              );
            }
            if (k === "BACK") {
              return (
                <button
                  key="back"
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); handleKey("BACK"); }}
                  className="w-12 h-10 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-red-600 text-slate-300 flex items-center justify-center transition-colors"
                >
                  <Delete className="h-4 w-4" />
                </button>
              );
            }
            return (
              <button
                key={k}
                type="button"
                onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
                className="flex-1 max-w-[42px] h-10 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white text-sm font-medium transition-colors"
              >
                {k}
              </button>
            );
          })}
        </div>
      ))}

      {/* Bottom row: close, space, special chars, enter */}
      <div className="flex gap-1">
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); handleKey("-"); }}
          className="w-10 h-10 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-sm font-medium transition-colors"
        >
          -
        </button>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); handleKey("@"); }}
          className="w-10 h-10 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-sm font-medium transition-colors"
        >
          @
        </button>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); handleKey(" "); }}
          className="flex-1 h-10 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-slate-400 text-xs font-medium transition-colors flex items-center justify-center gap-1"
        >
          <Space className="h-4 w-4" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); handleKey("'"); }}
          className="w-10 h-10 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-sm font-medium transition-colors"
        >
          &apos;
        </button>
        {onSubmit && (
          <button
            type="button"
            onPointerDown={(e) => { e.preventDefault(); onSubmit(); }}
            className="w-14 h-10 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center transition-colors"
          >
            <CornerDownLeft className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onClose(); }}
          className="w-10 h-10 rounded-lg bg-red-600/30 hover:bg-red-600/50 active:bg-red-600 text-red-400 text-xs font-bold transition-colors flex items-center justify-center"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function TouchKeyboardToggle({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors",
        className
      )}
      title="Clavier tactile"
    >
      <Keyboard className="h-4 w-4" />
    </button>
  );
}
