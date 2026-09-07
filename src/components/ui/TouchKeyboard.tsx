"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Delete, CornerDownLeft, Space, ChevronUp, X } from "lucide-react";
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

type ActiveTarget = HTMLInputElement | HTMLTextAreaElement;

function isTextInput(el: unknown): el is ActiveTarget {
  if (el instanceof HTMLInputElement && ["text", "search", "url", "email"].includes(el.type)) return true;
  if (el instanceof HTMLTextAreaElement) return true;
  return false;
}

const KB_WIDTH = 460;
const KB_HEIGHT = 250;

function computePosition(el: ActiveTarget) {
  const rect = el.getBoundingClientRect();
  let x = rect.left;
  let y = rect.bottom + 6;
  if (x + KB_WIDTH > window.innerWidth - 8) x = window.innerWidth - KB_WIDTH - 8;
  if (x < 8) x = 8;
  if (y + KB_HEIGHT > window.innerHeight - 8) y = rect.top - KB_HEIGHT - 6;
  if (y < 8) y = 8;
  return { x, y };
}

export function TouchKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<ActiveTarget | null>(null);
  const [shifted, setShifted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const closedManually = useRef<ActiveTarget | null>(null);

  const rows = shifted ? ROWS_UPPER : ROWS_LOWER;

  // Auto-show on focus
  useEffect(() => {
    function handleFocus(e: FocusEvent) {
      const el = e.target;
      if (isTextInput(el)) {
        if (closedManually.current === el) return;
        setTarget(el);
        setPos(computePosition(el));
      }
    }
    function handleBlur(e: FocusEvent) {
      if (!isTextInput(e.target)) return;
      requestAnimationFrame(() => {
        if (panelRef.current?.contains(document.activeElement)) return;
        const next = document.activeElement;
        if (isTextInput(next)) return;
        setTarget(null);
      });
    }
    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
    };
  }, []);

  // Reset manual-close tracking when target changes
  useEffect(() => {
    closedManually.current = null;
  }, [target]);

  const close = useCallback(() => {
    closedManually.current = target;
    setTarget(null);
  }, [target]);

  const dispatch = useCallback((char: string) => {
    const el = target;
    if (!el) return;
    el.focus();
    const nativeSet =
      el instanceof HTMLTextAreaElement
        ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
        : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!nativeSet) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    nativeSet.call(el, el.value.slice(0, start) + char + el.value.slice(end));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    const cursor = start + char.length;
    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));
  }, [target]);

  const backspace = useCallback(() => {
    const el = target;
    if (!el) return;
    el.focus();
    const nativeSet =
      el instanceof HTMLTextAreaElement
        ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
        : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!nativeSet) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    let newValue: string;
    let cursor: number;
    if (start !== end) {
      newValue = el.value.slice(0, start) + el.value.slice(end);
      cursor = start;
    } else if (start > 0) {
      newValue = el.value.slice(0, start - 1) + el.value.slice(start);
      cursor = start - 1;
    } else {
      return;
    }
    nativeSet.call(el, newValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));
  }, [target]);

  const submit = useCallback(() => {
    if (!target) return;
    target.focus();
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  }, [target]);

  const handleKey = useCallback((key: string) => {
    if (key === "SHIFT") { setShifted((s) => !s); return; }
    if (key === "BACK") { backspace(); return; }
    dispatch(key);
    if (shifted) setShifted(false);
  }, [dispatch, backspace, shifted]);

  return (
    <>
      {children}
      {target && (
        <div
          ref={panelRef}
          className="fixed z-[10002] select-none"
          style={{ left: pos.x, top: pos.y, width: KB_WIDTH, maxWidth: "calc(100vw - 16px)" }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-800/95 backdrop-blur-md border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
            {/* Title bar with close */}
            <div className="flex items-center justify-between px-3 py-1 bg-slate-700/60">
              <span className="text-[11px] font-medium text-slate-500">Clavier</span>
              <button
                type="button"
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); close(); }}
                className="w-6 h-6 rounded hover:bg-slate-600 text-slate-500 hover:text-red-400 flex items-center justify-center transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-1.5">
              {/* Number row */}
              <div className="flex gap-0.5 mb-0.5 justify-center">
                {NUM_ROW.map((k) => (
                  <button key={k} type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
                    className="flex-1 h-10 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white text-sm font-medium transition-colors"
                  >{k}</button>
                ))}
              </div>

              {/* Letter rows */}
              {rows.map((row, ri) => (
                <div key={ri} className="flex gap-0.5 mb-0.5 justify-center">
                  {row.map((k) => {
                    if (k === "SHIFT") return (
                      <button key="shift" type="button"
                        onPointerDown={(e) => { e.preventDefault(); handleKey("SHIFT"); }}
                        className={cn("w-12 h-10 rounded-md flex items-center justify-center transition-colors",
                          shifted ? "bg-blue-600 text-white" : "bg-slate-600 hover:bg-slate-500 text-slate-300")}
                      ><ChevronUp className="h-4 w-4" /></button>
                    );
                    if (k === "BACK") return (
                      <button key="back" type="button"
                        onPointerDown={(e) => { e.preventDefault(); handleKey("BACK"); }}
                        className="w-12 h-10 rounded-md bg-slate-600 hover:bg-slate-500 active:bg-red-600 text-slate-300 flex items-center justify-center transition-colors"
                      ><Delete className="h-4 w-4" /></button>
                    );
                    return (
                      <button key={k} type="button"
                        onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
                        className="flex-1 h-10 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white text-sm font-medium transition-colors"
                      >{k}</button>
                    );
                  })}
                </div>
              ))}

              {/* Bottom row */}
              <div className="flex gap-0.5">
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("-"); }}
                  className="w-10 h-10 rounded-md bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-sm font-medium transition-colors">-</button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("@"); }}
                  className="w-10 h-10 rounded-md bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-sm font-medium transition-colors">@</button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey(" "); }}
                  className="flex-1 h-10 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-slate-400 text-xs font-medium transition-colors flex items-center justify-center">
                  <Space className="h-4 w-4" /></button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("'"); }}
                  className="w-10 h-10 rounded-md bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-sm font-medium transition-colors">&apos;</button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); submit(); }}
                  className="w-14 h-10 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center transition-colors">
                  <CornerDownLeft className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
