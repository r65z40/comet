"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Delete, CornerDownLeft, Space, ChevronUp, X, Mic, MicOff } from "lucide-react";
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

const KB_WIDTH = 620;
const KEY_H = 52;

function computePosition(el: ActiveTarget) {
  const rect = el.getBoundingClientRect();
  const kbHeight = KEY_H * 5 + 4 * 4 + 16 + 36;
  let x = rect.left + rect.width / 2 - KB_WIDTH / 2;
  let y = rect.bottom + 8;
  if (x + KB_WIDTH > window.innerWidth - 8) x = window.innerWidth - KB_WIDTH - 8;
  if (x < 8) x = 8;
  if (y + kbHeight > window.innerHeight - 8) y = rect.top - kbHeight - 8;
  if (y < 8) y = 8;
  return { x, y };
}

export function TouchKeyboardProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<ActiveTarget | null>(null);
  const [shifted, setShifted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [listening, setListening] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closedManually = useRef<ActiveTarget | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const rows = shifted ? ROWS_UPPER : ROWS_LOWER;

  const hasSpeechRecognition = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

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

  useEffect(() => {
    closedManually.current = null;
  }, [target]);

  useEffect(() => {
    if (!target && listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
  }, [target, listening]);

  const close = useCallback(() => {
    closedManually.current = target;
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
    }
    setTarget(null);
  }, [target, listening]);

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

  const handleKey = useCallback((key: string) => {
    if (key === "SHIFT") { setShifted((s) => !s); return; }
    if (key === "BACK") { backspace(); return; }
    dispatch(key);
    if (shifted) setShifted(false);
  }, [dispatch, backspace, shifted]);

  const toggleDictation = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const el = target;
    if (!el) return;

    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last?.[0]?.transcript ?? "";
      if (!transcript) return;

      el.focus();
      const nativeSet =
        el instanceof HTMLTextAreaElement
          ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
          : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      if (!nativeSet) return;
      const cur = el.value;
      nativeSet.call(el, cur ? cur + " " + transcript : transcript);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      const end = el.value.length;
      requestAnimationFrame(() => el.setSelectionRange(end, end));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [target, listening]);

  const keyStyle: React.CSSProperties = {
    height: KEY_H,
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 500,
  };

  const specialW = 64;

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
            <div className="flex items-center justify-between px-4 py-1.5 bg-slate-700/60">
              <span className="text-xs font-medium text-slate-500">Clavier</span>
              <button
                type="button"
                onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); close(); }}
                className="w-7 h-7 rounded hover:bg-slate-600 text-slate-500 hover:text-red-400 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-2" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {/* Number row */}
              <div style={{ display: "flex", gap: 4 }}>
                {NUM_ROW.map((k) => (
                  <button key={k} type="button"
                    onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white transition-colors flex items-center justify-center"
                    style={keyStyle}
                  >{k}</button>
                ))}
              </div>

              {/* Letter rows */}
              {rows.map((row, ri) => (
                <div key={ri} style={{ display: "flex", gap: 4 }}>
                  {row.map((k) => {
                    if (k === "SHIFT") return (
                      <button key="shift" type="button"
                        onPointerDown={(e) => { e.preventDefault(); handleKey("SHIFT"); }}
                        className={cn("flex items-center justify-center transition-colors",
                          shifted ? "bg-blue-600 text-white" : "bg-slate-600 hover:bg-slate-500 text-slate-300")}
                        style={{ ...keyStyle, width: specialW }}
                      ><ChevronUp className="h-5 w-5" /></button>
                    );
                    if (k === "BACK") return (
                      <button key="back" type="button"
                        onPointerDown={(e) => { e.preventDefault(); handleKey("BACK"); }}
                        className="bg-slate-600 hover:bg-slate-500 active:bg-red-600 text-slate-300 flex items-center justify-center transition-colors"
                        style={{ ...keyStyle, width: specialW }}
                      ><Delete className="h-5 w-5" /></button>
                    );
                    return (
                      <button key={k} type="button"
                        onPointerDown={(e) => { e.preventDefault(); handleKey(k); }}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-white transition-colors flex items-center justify-center"
                        style={keyStyle}
                      >{k}</button>
                    );
                  })}
                </div>
              ))}

              {/* Bottom row */}
              <div style={{ display: "flex", gap: 4 }}>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("-"); }}
                  className="bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 transition-colors flex items-center justify-center"
                  style={{ ...keyStyle, width: 52 }}>-</button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("@"); }}
                  className="bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 transition-colors flex items-center justify-center"
                  style={{ ...keyStyle, width: 52 }}>@</button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey(" "); }}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 active:bg-blue-600 text-slate-400 transition-colors flex items-center justify-center"
                  style={keyStyle}>
                  <Space className="h-5 w-5" /></button>
                <button type="button" onPointerDown={(e) => { e.preventDefault(); handleKey("'"); }}
                  className="bg-slate-600 hover:bg-slate-500 active:bg-blue-600 text-slate-300 transition-colors flex items-center justify-center"
                  style={{ ...keyStyle, width: 52 }}>&apos;</button>
                {hasSpeechRecognition && (
                  <button type="button"
                    onPointerDown={(e) => { e.preventDefault(); }}
                    onClick={() => toggleDictation()}
                    className={cn(
                      "flex items-center justify-center transition-colors",
                      listening
                        ? "bg-red-500/80 hover:bg-red-500 text-white animate-pulse"
                        : "bg-slate-600 hover:bg-slate-500 text-slate-300",
                    )}
                    style={{ ...keyStyle, width: 56 }}
                    title={listening ? "Arrêter la dictée" : "Dictée vocale"}
                  >
                    {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>
                )}
                <button type="button" onPointerDown={(e) => { e.preventDefault(); close(); }}
                  className="bg-green-600 hover:bg-green-500 active:bg-green-700 text-white flex items-center justify-center transition-colors"
                  style={{ ...keyStyle, width: 56 }}
                  title="Valider et fermer le clavier"
                >
                  <CornerDownLeft className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
