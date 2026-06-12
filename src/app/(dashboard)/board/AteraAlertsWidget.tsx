"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  XCircle,
  Info,
  RefreshCw,
  Monitor,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AteraAlert {
  id: number;
  title: string;
  severity: "Critical" | "Warning" | "Information";
  deviceName: string | null;
  customerName: string | null;
  created: string | null;
}

const SEV_CONFIG = {
  Critical: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/20", dot: "bg-red-500", label: "Critique" },
  Warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/20", dot: "bg-amber-500", label: "Avertissement" },
  Information: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/20", dot: "bg-blue-500", label: "Info" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

export default function AteraAlertsWidget({ dark }: { dark?: boolean }) {
  const [alerts, setAlerts] = useState<AteraAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/atera/alerts?limit=100");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchAlerts, 120_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-full", dark ? "text-slate-500" : "text-slate-400")}>
        <RefreshCw className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center h-full text-xs", dark ? "text-slate-500" : "text-slate-400")}>
        Impossible de charger les alertes
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-xs gap-1", dark ? "text-slate-500" : "text-slate-400")}>
        <AlertTriangle className="h-5 w-5 opacity-30" />
        Aucune alerte active
      </div>
    );
  }

  const stats = {
    critical: alerts.filter((a) => a.severity === "Critical").length,
    warning: alerts.filter((a) => a.severity === "Warning").length,
    info: alerts.filter((a) => a.severity === "Information").length,
  };

  const sorted = [...alerts].sort((a, b) => {
    const order = { Critical: 0, Warning: 1, Information: 2 };
    const diff = order[a.severity] - order[b.severity];
    if (diff !== 0) return diff;
    if (a.created && b.created) return new Date(b.created).getTime() - new Date(a.created).getTime();
    return 0;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className={cn("flex items-center gap-3 px-3 py-2 border-b shrink-0", dark ? "border-slate-700" : "border-slate-100")}>
        {stats.critical > 0 && (
          <div className="flex items-center gap-1 animate-pulse">
            <XCircle className="h-3.5 w-3.5 text-red-500" />
            <span className={cn("text-xs font-bold", dark ? "text-red-400" : "text-red-600")}>{stats.critical}</span>
          </div>
        )}
        {stats.warning > 0 && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className={cn("text-xs font-bold", dark ? "text-amber-400" : "text-amber-600")}>{stats.warning}</span>
          </div>
        )}
        {stats.info > 0 && (
          <div className="flex items-center gap-1">
            <Info className="h-3.5 w-3.5 text-blue-500" />
            <span className={cn("text-xs font-bold", dark ? "text-blue-400" : "text-blue-600")}>{stats.info}</span>
          </div>
        )}
        <span className={cn("text-[10px] ml-auto", dark ? "text-slate-500" : "text-slate-400")}>
          {alerts.length} alerte{alerts.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((alert) => {
          const cfg = SEV_CONFIG[alert.severity];
          const Icon = cfg.icon;

          return (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-2 px-3 py-2 border-b",
                dark ? "border-slate-700/50 hover:bg-slate-700/30" : "border-slate-50 hover:bg-slate-50",
                alert.severity === "Critical" && (dark ? "bg-red-500/10" : "bg-red-50/50"),
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", cfg.color, alert.severity === "Critical" && "animate-pulse")} />

              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-medium truncate", dark ? "text-slate-200" : "text-slate-700")}>
                  {alert.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {alert.deviceName && (
                    <span className={cn("flex items-center gap-0.5 text-[10px] truncate", dark ? "text-slate-500" : "text-slate-400")}>
                      <Monitor className="h-2.5 w-2.5 shrink-0" />
                      {alert.deviceName}
                    </span>
                  )}
                  {alert.customerName && (
                    <span className={cn("text-[10px] truncate", dark ? "text-slate-500" : "text-slate-400")}>
                      {alert.customerName}
                    </span>
                  )}
                </div>
              </div>

              {alert.created && (
                <span className={cn("text-[9px] shrink-0 flex items-center gap-0.5 mt-0.5", dark ? "text-slate-600" : "text-slate-400")}>
                  <Clock className="h-2.5 w-2.5" />
                  {timeAgo(alert.created)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
