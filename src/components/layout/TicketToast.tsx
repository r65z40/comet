"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Ticket } from "lucide-react";

interface TicketNotification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
}

interface ToastItem extends TicketNotification {
  dismissAt: number;
}

export default function TicketToast() {
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/recent-tickets");
      if (!res.ok) return;
      const notifications: TicketNotification[] = await res.json();

      const newToasts: ToastItem[] = [];
      for (const n of notifications) {
        if (seenIds.current.has(n.id)) continue;
        seenIds.current.add(n.id);
        newToasts.push({ ...n, dismissAt: Date.now() + 8000 });
      }

      if (newToasts.length > 0) {
        setToasts((prev) => [...newToasts, ...prev].slice(0, 3));
      }
    } catch {}
  }, []);

  // Poll every 15 seconds
  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 15000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => t.dismissAt > now));
    }, 1000);

    return () => clearInterval(timer);
  }, [toasts.length]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function handleClick(toast: ToastItem) {
    dismiss(toast.id);
    if (toast.link) router.push(toast.link);
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-4 w-80 animate-in slide-in-from-right-full duration-300 cursor-pointer hover:shadow-3xl transition-shadow"
          onClick={() => handleClick(toast)}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Ticket className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {toast.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                {toast.message}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(toast.id);
              }}
              className="shrink-0 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
