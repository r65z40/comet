"use client";

import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { Keyboard, Delete, CornerDownLeft, Space, ChevronUp, X } from "lucide-react";
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
  const targetRef = useRef<ActiveTarget | null>(null);

  const rows = shifted ? ROWS_UPPER : ROWS_LOWER;

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (!open) return;
    function handleFocus(e: FocusEvent) {
      const el = e.target as HTMLElement;
      if (
        (el instanceof HTMLInputElement && (el.type === "text" || el.type === "search" || el.type === "url" || el.type === "email")) ||
        el instanceof HTMLTextAreaElement
      ) {
        targetRef.current = el as ActiveTarget;
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
      }
    }
  }, [open]);

  const dispatch = useCallback((char: string) => {
    const el = targetRef.current;
    if (!el) return;
    el.focus();
    const nativeInputValueSetter =
      el instanceof HTMLTextAreaElement
        ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
        : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!nativeInputValueSetter) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const before = el.value.slice(0, start);
    const after = el.value.slice(end);
    const newValue = before + char + after;

    nativeInputValueSetter.call(el, newValue);
    el.dispatchEvent(new Event("input", { bubbles: true }));

    const cursor = start + char.length;
    requestAnimationFrame(() => el.setSelectionRange(cursor, cursor));
  }, []);

  const backspace = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    el.focus();
    const nativeInputValueSetter =
      el instanceof HTMLTextAreaElement
        ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
        : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (!nativeInputValueSetter) return;

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

    nativeInputValueSetter.call(el, newValue);
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
      {open && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[10002] bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-2 pb-3 select-none safe-area-bottom"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="max-w-2xl mx-auto">
            {/* Number row */}
            <div className="flex gap-1 mb-1 justify-center">
              {NUM_ROW.map((k) => (
                <button
                  key={k}
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
                  className="flex-1 max-w-[48px] h-11 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white text-base font-medium transition-colors"
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
                          "w-14 h-11 rounded-lg flex items-center justify-center transition-colors",
                          shifted ? "bg-blue-600 text-white" : "bg-slate-600 hover:bg-slate-500 text-slate-300"
                        )}
                      >
                        <ChevronUp className="h-5 w-5" />
                      </button>
                    );
                  }
                  if (k === "BACK") {
                    return (
                      <button
                        key="back"
                        type="button"
                        onPointerDown={(e) => { e.preventDefault(); handleKey("BACK"); }}
                        className="w-14 h-11 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-red-600 text-slate-300 flex items-center justify-center transition-colors"
                      >
                        <Delete className="h-5 w-5" />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={k}
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
                      className="flex-1 max-w-[48px] h-11 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white text-base font-medium transition-colors"
                    >
                      {k}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Bottom row */}
            <div className="flex gap-1">
              <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("-"); }}
                className="w-11 h-11 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-base font-medium transition-colors">-</button>
              <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("@"); }}
                className="w-11 h-11 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-base font-medium transition-colors">@</button>
              <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey(" "); }}
                className="flex-1 h-11 rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-slate-400 text-xs font-medium transition-colors flex items-center justify-center gap-1">
                <Space className="h-5 w-5" />
              </button>
              <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("'"); }}
                className="w-11 h-11 rounded-lg bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 text-base font-medium transition-colors">&apos;</button>
              <button type="button" onPointerDown={(e) => { e.preventDefault(); submit(); }}
                className="w-16 h-11 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center justify-center transition-colors">
                <CornerDownLeft className="h-5 w-5" />
              </button>
              <button type="button" onPointerDown={(e) => { e.preventDefault(); setOpen(false); }}
                className="w-11 h-11 rounded-lg bg-red-600/30 hover:bg-red-600/50 active:bg-red-600 text-red-400 flex items-center justify-center transition-colors">
                <X className="h-5 w-5" />
              </button>
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
        "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
        open
          ? "bg-blue-600/30 text-blue-400 hover:bg-blue-600/50"
          : "bg-slate-700/60 hover:bg-slate-600 text-slate-400 hover:text-slate-200",
        className
      )}
      title="Clavier tactile"
    >
      <Keyboard className="h-4 w-4" />
    </button>
  );
}
