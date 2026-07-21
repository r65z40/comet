"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketNotification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
}

export default function TicketToast({ dark }: { dark?: boolean }) {
  const router = useRouter();
  const [toasts, setToasts] = useState<TicketNotification[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/recent-tickets");
      if (!res.ok) return;
      const notifications: TicketNotification[] = await res.json();

      const newToasts: TicketNotification[] = [];
      for (const n of notifications) {
        if (seenIds.current.has(n.id)) continue;
        seenIds.current.add(n.id);
        newToasts.push(n);
      }

      if (newToasts.length > 0) {
        setToasts((prev) => [...newToasts, ...prev].slice(0, 5));
      }
    } catch {}
  }, []);

  // Poll every 15 seconds
  useEffect(() => {
    fetchRecent();
    const interval = setInterval(fetchRecent, 15000);
    return () => clearInterval(interval);
  }, [fetchRecent]);

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    // Mark as read so it doesn't reappear
    fetch("/api/notifications/inbox", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  }

  function handleClick(toast: TicketNotification) {
    dismiss(toast.id);
    if (toast.link) router.push(toast.link);
  }

  if (toasts.length === 0) return null;

  return (
    <div className={cn(
      "fixed z-[10000] flex flex-col pointer-events-none",
      dark ? "bottom-6 right-6 gap-3" : "bottom-4 right-4 gap-2",
    )}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto rounded-xl shadow-2xl cursor-pointer hover:shadow-3xl transition-shadow animate-in slide-in-from-right-full duration-300",
            dark
              ? "bg-slate-800 border border-slate-600 p-5 w-[420px]"
              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 w-80",
          )}
          onClick={() => handleClick(toast)}
        >
          <div className={cn("flex items-start", dark ? "gap-4" : "gap-3")}>
            <div className={cn(
              "shrink-0 rounded-full flex items-center justify-center",
              dark
                ? "w-12 h-12 bg-blue-900/40"
                : "w-9 h-9 bg-blue-100 dark:bg-blue-900/40",
            )}>
              <Ticket className={cn(
                dark ? "h-6 w-6 text-blue-400" : "h-4 w-4 text-blue-600 dark:text-blue-400",
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold truncate",
                dark ? "text-base text-white" : "text-sm text-slate-900 dark:text-white",
              )}>
                {toast.title}
              </p>
              <p className={cn(
                "mt-0.5 line-clamp-2",
                dark ? "text-sm text-slate-400" : "text-xs text-slate-500 dark:text-slate-400",
              )}>
                {toast.message}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(toast.id);
              }}
              className={cn(
                "shrink-0 rounded-lg transition-colors",
                dark
                  ? "p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                  : "p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
              )}
            >
              <X className={cn(dark ? "h-5 w-5" : "h-3.5 w-3.5")} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
