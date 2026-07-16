"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const RGL = require("react-grid-layout/legacy") as { default: React.ComponentType<Record<string, unknown>> };
const GridLayout = RGL.default || RGL;
import { GripHorizontal, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
};

export interface GridWidget {
  id: string;
  title: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface Props {
  widgets: GridWidget[];
  defaultLayout: LayoutItem[];
  storageKey: string;
  dark?: boolean;
  rowHeight?: number;
  className?: string;
}

function WidgetContentArea({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    // Native touchstart listener — react-draggable adds a native touchstart
    // listener on the parent grid-item wrapper, and React's synthetic
    // stopPropagation cannot prevent native listeners from firing.
    // Stopping propagation here blocks react-draggable while letting
    // pointerdown (which fires first) reach dnd-kit normally.
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("touchstart", stop, { passive: false });
    return () => el.removeEventListener("touchstart", stop);
  }, []);

  return (
    <div
      ref={contentRef}
      className="widget-content flex-1 overflow-auto min-h-0"
      style={{ touchAction: "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export default function DashboardGrid({
  widgets,
  defaultLayout,
  storageKey,
  dark = false,
  rowHeight = 60,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [allPositions, setAllPositions] = useState<LayoutItem[]>(defaultLayout);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as LayoutItem[];
        setAllPositions(
          defaultLayout.map((d) => {
            const s = parsed.find((p) => p.i === d.i);
            return s
              ? { ...d, x: s.x, y: s.y, w: s.w, h: s.h }
              : d;
          }),
        );
      }
    } catch {}
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.floor(e.contentRect.width)),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const activeLayout = allPositions.filter((l) =>
    widgets.some((ww) => ww.id === l.i),
  );

  function onLayoutChange(nl: readonly LayoutItem[]) {
    setAllPositions((prev) => {
      const next = prev.map((p) => {
        const u = nl.find((n) => n.i === p.i);
        return u ? { ...p, x: u.x, y: u.y, w: u.w, h: u.h } : p;
      });
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function reset() {
    setAllPositions([...defaultLayout]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      {ready && w > 0 && (
        <GridLayout
          layout={activeLayout}
          cols={12}
          rowHeight={rowHeight}
          width={w}
          margin={[8, 8]}
          containerPadding={[0, 0]}
          draggableHandle=".widget-drag-handle"
          draggableCancel=".widget-content"
          onLayoutChange={onLayoutChange}
          compactType="vertical"
          resizeHandles={["se"]}
          useCSSTransforms
        >
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className={cn(
                "rounded-xl border overflow-hidden flex flex-col",
                dark
                  ? "bg-slate-800/60 border-slate-700"
                  : "bg-white border-slate-200 shadow-sm",
              )}
            >
              <div
                className={cn(
                  "widget-drag-handle flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing shrink-0 select-none border-b",
                  dark
                    ? "bg-slate-700/50 border-slate-600"
                    : "bg-slate-50/80 border-slate-100",
                )}
              >
                <GripHorizontal
                  className={cn(
                    "h-4 w-4 shrink-0",
                    dark ? "text-slate-500" : "text-slate-300",
                  )}
                />
                {widget.icon}
                <span
                  className={cn(
                    "text-xs font-medium truncate",
                    dark ? "text-slate-400" : "text-slate-500",
                  )}
                >
                  {widget.title}
                </span>
              </div>
              <WidgetContentArea>{widget.content}</WidgetContentArea>
            </div>
          ))}
        </GridLayout>
      )}
      <button
        onClick={reset}
        className={cn(
          "absolute bottom-2 right-2 p-2.5 rounded-xl z-50 opacity-30 hover:opacity-100 transition-opacity",
          dark
            ? "bg-slate-700 text-slate-400"
            : "bg-white border border-slate-200 text-slate-400",
        )}
        title="Réinitialiser la disposition"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}
