"use client";

import { useEffect, useState, useCallback } from "react";
import { Globe, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
  category: string;
}

const SOURCE_COLORS: Record<string, string> = {
  "France 24": "text-blue-400",
  "Le Monde": "text-amber-400",
  "RFI": "text-emerald-400",
  "BBC World": "text-red-400",
  "Le Point": "text-purple-400",
};

const SOURCE_COLORS_LIGHT: Record<string, string> = {
  "France 24": "text-blue-600",
  "Le Monde": "text-amber-600",
  "RFI": "text-emerald-600",
  "BBC World": "text-red-600",
  "Le Point": "text-purple-600",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export default function NewsWidget({ dark }: { dark?: boolean }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/board/news-feed");
      if (res.ok) {
        setNews(await res.json());
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-full", dark ? "text-slate-400" : "text-slate-500")}>
        <RefreshCw className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error || news.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full gap-2", dark ? "text-slate-500" : "text-slate-400")}>
        <Globe className="h-8 w-8 opacity-50" />
        <p className="text-sm">{error ? "Flux indisponible" : "Aucune actualité"}</p>
        <button
          onClick={() => { setLoading(true); fetchNews(); }}
          className={cn("text-xs px-3 py-1.5 rounded-lg transition-colors", dark ? "bg-slate-700 hover:bg-slate-600 text-slate-300" : "bg-slate-100 hover:bg-slate-200 text-slate-600")}
        >
          Réessayer
        </button>
      </div>
    );
  }

  const colorMap = dark ? SOURCE_COLORS : SOURCE_COLORS_LIGHT;

  return (
    <div className="flex flex-col h-full">
      <div className={cn("flex-1 overflow-y-auto divide-y", dark ? "divide-slate-700/50" : "divide-slate-100")}>
        {news.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex gap-3 px-4 py-3 group transition-colors",
              dark ? "hover:bg-slate-700/30" : "hover:bg-slate-50"
            )}
          >
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm font-medium line-clamp-2 leading-snug",
                dark ? "text-slate-200 group-hover:text-white" : "text-slate-800 group-hover:text-slate-900"
              )}>
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={cn("text-xs font-semibold", colorMap[item.source] || (dark ? "text-slate-400" : "text-slate-500"))}>
                  {item.source}
                </span>
                <span className={cn("text-xs", dark ? "text-slate-600" : "text-slate-400")}>·</span>
                <span className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>
                  {timeAgo(item.date)}
                </span>
              </div>
            </div>
            <ExternalLink className={cn(
              "h-3.5 w-3.5 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
              dark ? "text-slate-500" : "text-slate-400"
            )} />
          </a>
        ))}
      </div>
      <div className={cn(
        "shrink-0 px-4 py-2 border-t flex items-center gap-2 text-xs",
        dark ? "border-slate-700 bg-slate-800/50 text-slate-500" : "border-slate-100 bg-slate-50/50 text-slate-400"
      )}>
        <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dark ? "bg-emerald-500" : "bg-emerald-400")} />
        Actualisation toutes les 15 min
      </div>
    </div>
  );
}
