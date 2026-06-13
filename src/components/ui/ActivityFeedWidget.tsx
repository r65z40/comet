"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  History,
  ClipboardList,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedItem {
  id: string;
  type: "activity" | "card" | "ticket_comment" | "card_comment";
  action: string;
  userName: string;
  entity: string;
  entityId: string;
  title: string;
  detail?: string;
  date: string;
}

const FEED_TYPE_CONFIG: Record<
  string,
  { icon: typeof Activity; color: string; darkColor: string; bg: string; darkBg: string }
> = {
  activity: { icon: History, color: "text-blue-600", darkColor: "text-blue-400", bg: "bg-blue-50", darkBg: "bg-blue-500/20" },
  card: { icon: ClipboardList, color: "text-purple-600", darkColor: "text-purple-400", bg: "bg-purple-50", darkBg: "bg-purple-500/20" },
  ticket_comment: { icon: MessageSquare, color: "text-emerald-600", darkColor: "text-emerald-400", bg: "bg-emerald-50", darkBg: "bg-emerald-500/20" },
  card_comment: { icon: MessageSquare, color: "text-orange-600", darkColor: "text-orange-400", bg: "bg-orange-50", darkBg: "bg-orange-500/20" },
};

const AVATAR_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function ActivityFeedWidget({ dark = false }: { dark?: boolean }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(() => {
    fetch("/api/activity/feed?limit=20")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setItems(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px]">
        <RefreshCw className={cn("h-5 w-5 animate-spin", dark ? "text-slate-500" : "text-slate-300")} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className={cn("text-sm text-center py-8", dark ? "text-slate-500" : "text-slate-400")}>
        Aucune activité récente
      </p>
    );
  }

  return (
    <div className="space-y-0.5 p-2 h-full overflow-y-auto">
      {items.map((item) => {
        const cfg = FEED_TYPE_CONFIG[item.type] || FEED_TYPE_CONFIG.activity;
        const IconComp = cfg.icon;
        const initial = (item.userName || "?").charAt(0).toUpperCase();
        const bgColor = avatarColor(item.userName);
        return (
          <div
            key={`${item.type}-${item.id}`}
            className={cn(
              "flex items-start gap-2 rounded-lg p-1.5 transition-colors",
              dark ? "hover:bg-slate-700/30" : "hover:bg-slate-50",
            )}
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
              style={{ backgroundColor: bgColor }}
            >
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs leading-snug", dark ? "text-slate-300" : "text-slate-700")}>
                <span className={cn("font-semibold", dark ? "text-white" : "text-slate-900")}>
                  {item.userName}
                </span>{" "}
                {item.title}
              </p>
              {item.detail && (
                <p className={cn("text-[10px] truncate mt-0.5", dark ? "text-slate-500" : "text-slate-400")}>
                  {item.detail}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
              <div className={cn("rounded p-0.5", dark ? cfg.darkBg : cfg.bg)}>
                <IconComp className={cn("h-2.5 w-2.5", dark ? cfg.darkColor : cfg.color)} />
              </div>
              <span className={cn("text-[9px] whitespace-nowrap", dark ? "text-slate-500" : "text-slate-400")}>
                {timeAgo(item.date)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
