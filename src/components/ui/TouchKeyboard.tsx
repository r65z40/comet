"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { Keyboard, Delete, CornerDownLeft, Space, ChevronUp, X, GripHorizontal } from "lucide-react";
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

const TouchKeyboardContext = createContext<{
  open: boolean;
  toggle: () => void;
}>({ open: false, toggle: () => {} });

export function useTouchKeyboard() {
  return useContext(TouchKeyboardContext);
}

export function TouchKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [shifted, setShifted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const targetRef = useRef<ActiveTarget | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const rows = shifted ? ROWS_UPPER : ROWS_LOWER;

  const toggle = useCallback(() => setOpen((o) => !o), []);

  function positionNearTarget(el: ActiveTarget) {
    const rect = el.getBoundingClientRect();
    const kbWidth = 480;
    const kbHeight = 260;
    let x = Math.max(8, rect.left);
    let y = rect.bottom + 8;
    if (x + kbWidth > window.innerWidth - 8) x = window.innerWidth - kbWidth - 8;
    if (y + kbHeight > window.innerHeight - 8) y = rect.top - kbHeight - 8;
    if (y < 8) y = 8;
    setPos({ x, y });
  }

  useEffect(() => {
    if (!open) return;
    function handleFocus(e: FocusEvent) {
      const el = e.target as HTMLElement;
      if (
        (el instanceof HTMLInputElement && ["text", "search", "url", "email"].includes(el.type)) ||
        el instanceof HTMLTextAreaElement
      ) {
        targetRef.current = el as ActiveTarget;
        positionNearTarget(el as ActiveTarget);
      }
    }
    document.addEventListener("focusin", handleFocus);
    return () => document.removeEventListener("focusin", handleFocus);
  }, [open]);

  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      if (
        (active instanceof HTMLInputElement && ["text", "search", "url", "email"].includes(active.type)) ||
        active instanceof HTMLTextAreaElement
      ) {
        targetRef.current = active as ActiveTarget;
        positionNearTarget(active as ActiveTarget);
      } else {
        setPos({ x: Math.max(8, (window.innerWidth - 480) / 2), y: window.innerHeight - 280 });
      }
    }
  }, [open]);

  // Drag handling
  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clientX = e.clientX;
    const clientY = e.clientY;
    if (!pos) return;
    dragState.current = { startX: clientX, startY: clientY, origX: pos.x, origY: pos.y };

    function onMove(ev: PointerEvent) {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 100, dragState.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragState.current.origY + dy)),
      });
    }
    function onUp() {
      dragState.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [pos]);

  const dispatch = useCallback((char: string) => {
    const el = targetRef.current;
    if (!el) return;
    el.focus();
    const nativeSet =
      el instanceof HTMLTextAreaElement
        ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
        : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!nativeSet) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newValue = el.value.slice(0, start) + char + el.value.slice(end);

    nativeSet.call(el, newValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));

    const cursor = start + char.length;
    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));
  }, []);

  const backspace = useCallback(() => {
    const el = targetRef.current;
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
  }, []);

  const submit = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.focus();
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  }, []);

  const handleKey = useCallback((key: string) => {
    if (key === "SHIFT") {
      setShifted((s) => !s);
      return;
    }
    if (key === "BACK") {
      backspace();
      return;
    }
    dispatch(key);
    if (shifted) setShifted(false);
  }, [dispatch, backspace, shifted]);

  return (
    <TouchKeyboardContext.Provider value={{ open, toggle }}>
      {children}
      {open && pos && (
        <div
          ref={panelRef}
          className="fixed z-[10002] select-none"
          style={{ left: pos.x, top: pos.y, width: 480, maxWidth: "calc(100vw - 16px)" }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-800/95 backdrop-blur-md border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
            {/* Drag handle + close */}
            <div
              className="flex items-center justify-between px-3 py-1.5 bg-slate-700/80 cursor-grab active:cursor-grabbing"
              onPointerDown={onDragStart}
            >
              <div className="flex items-center gap-2 text-slate-400">
                <GripHorizontal className="h-4 w-4" />
                <span className="text-xs font-medium">Clavier</span>
              </div>
              <button
                type="button"
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(false); }}
                className="w-7 h-7 rounded-md hover:bg-slate-600 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-1.5">
              {/* Number row */}
              <div className="flex gap-0.5 mb-0.5 justify-center">
                {NUM_ROW.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
                    className="flex-1 h-10 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white text-sm font-medium transition-colors"
                  >
                    {k}
                  </button>
                ))}
              </div>

              {/* Letter rows */}
              {rows.map((row, ri) => (
                <div key={ri} className="flex gap-0.5 mb-0.5 justify-center">
                  {row.map((k) => {
                    if (k === "SHIFT") {
                      return (
                        <button
                          key="shift"
                          type="button"
                          onPointerDown={(e) => { e.preventDefault(); handleKey("SHIFT"); }}
                          className={cn(
                            "w-12 h-10 rounded-md flex items-center justify-center transition-colors",
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
                          className="w-12 h-10 rounded-md bg-slate-600 hover:bg-slate-500 active:bg-red-600 text-slate-300 flex items-center justify-center transition-colors"
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
                        className="flex-1 h-10 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white text-sm font-medium transition-colors"
                      >
                        {k}
                      </button>
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
                  <Space className="h-4 w-4" />
                </button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("'"); }}
                  className="w-10 h-10 rounded-md bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-sm font-medium transition-colors">&apos;</button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); submit(); }}
                  className="w-14 h-10 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center transition-colors">
                  <CornerDownLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TouchKeyboardContext.Provider>
  );
}

export function TouchKeyboardToggle({ className }: { className?: string }) {
  const { open, toggle } = useTouchKeyboard();
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggle(); }}
      className={cn(
        "flex items-center justify-center w-10 h-10 transition-colors",
        open
          ? "bg-blue-600/30 text-blue-400 hover:bg-blue-600/50"
          : "bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200",
        className
      )}
      title="Clavier tactile"
    >
      <Keyboard className="h-5 w-5" />
    </button>
  );
}
