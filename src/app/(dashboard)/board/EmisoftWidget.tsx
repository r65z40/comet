"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, ShieldAlert, RefreshCw, Bug, Monitor, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmsisoftSummary {
  enabled: boolean;
  totalDevices: number;
  totalFindings: number;
  workspaceCount: number;
  recentAlerts: { workspaceName: string; findingType: string; detectedAt: string }[];
  workspaces: {
    id: string;
    name: string;
    devices: number;
    findingsLastMonth: number;
    lastAlert: string | null;
    isExpired: boolean;
    isExpiresSoon: boolean;
    totalSeat: number;
    usedSeat: number;
  }[];
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function EmisoftWidget({ dark = false }: { dark?: boolean }) {
  const [data, setData] = useState<EmsisoftSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/emsisoft");
      if (!res.ok) throw new Error("Erreur API");
      const json = await res.json();
      if (!json.enabled) {
        setError("non_configured");
        return;
      }
      setData(json);
      setError(null);
    } catch {
      setError("fetch_error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[100px]">
        <RefreshCw className={cn("h-5 w-5 animate-spin", dark ? "text-slate-500" : "text-slate-300")} />
      </div>
    );
  }

  if (error === "non_configured") {
    return (
      <div className={cn("flex items-center justify-center h-full p-4", dark ? "text-slate-500" : "text-slate-400")}>
        <p className="text-xs text-center">Emsisoft non configuré.<br />Ajoutez votre clé API dans Paramètres &gt; Intégrations.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn("flex items-center justify-center h-full p-4", dark ? "text-red-400" : "text-red-500")}>
        <p className="text-xs">Erreur de connexion Emsisoft</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className={cn("grid grid-cols-3 gap-1 p-2 border-b", dark ? "border-slate-700" : "border-slate-100")}>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <Building2 className={cn("h-4 w-4 mb-0.5", dark ? "text-blue-400" : "text-blue-500")} />
          <span className={cn("text-lg font-bold leading-none", dark ? "text-blue-400" : "text-blue-600")}>{data.workspaceCount}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>Workspaces</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <Monitor className={cn("h-4 w-4 mb-0.5", dark ? "text-emerald-400" : "text-emerald-500")} />
          <span className={cn("text-lg font-bold leading-none", dark ? "text-emerald-400" : "text-emerald-600")}>{data.totalDevices}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>Appareils</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <Bug className={cn("h-4 w-4 mb-0.5", data.totalFindings > 0 ? (dark ? "text-amber-400" : "text-amber-500") : (dark ? "text-slate-600" : "text-slate-300"))} />
          <span className={cn("text-lg font-bold leading-none", data.totalFindings > 0 ? (dark ? "text-amber-400" : "text-amber-600") : (dark ? "text-slate-500" : "text-slate-400"))}>{data.totalFindings}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>Détections/mois</span>
        </div>
      </div>

      {/* Workspaces list */}
      <div className="flex-1 overflow-y-auto">
        {data.workspaces.length === 0 ? (
          <div className={cn("flex flex-col items-center justify-center h-full py-6 gap-2", dark ? "text-slate-500" : "text-slate-400")}>
            <Shield className="h-8 w-8 opacity-30" />
            <p className="text-xs">Aucun workspace</p>
          </div>
        ) : (
          <div className={cn("divide-y", dark ? "divide-slate-700/50" : "divide-slate-100")}>
            {data.workspaces.map((ws) => (
              <div key={ws.id} className={cn("px-3 py-2", dark ? "hover:bg-slate-700/30" : "hover:bg-slate-50")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className={cn("h-3.5 w-3.5 shrink-0", dark ? "text-slate-500" : "text-slate-400")} />
                    <span className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-900")}>{ws.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ws.isExpired && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Expiré</span>
                    )}
                    {ws.isExpiresSoon && !ws.isExpired && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Expire bientôt</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1 ml-5.5">
                  <span className={cn("text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>
                    {ws.devices} appareil{ws.devices > 1 ? "s" : ""} • {ws.usedSeat}/{ws.totalSeat} sièges
                  </span>
                  {ws.findingsLastMonth > 0 && (
                    <span className={cn("text-[10px]", dark ? "text-amber-400" : "text-amber-600")}>
                      {ws.findingsLastMonth} détection{ws.findingsLastMonth > 1 ? "s" : ""}/mois
                    </span>
                  )}
                  {ws.lastAlert && (
                    <span className={cn("text-[10px]", dark ? "text-slate-600" : "text-slate-400")}>
                      {timeAgo(ws.lastAlert)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent alerts */}
      {data.recentAlerts.length > 0 && (
        <div className={cn("border-t", dark ? "border-slate-700" : "border-slate-100")}>
          <p className={cn("px-3 pt-2 pb-1 text-[10px] font-medium", dark ? "text-slate-500" : "text-slate-400")}>Alertes récentes</p>
          <div className={cn("divide-y max-h-[120px] overflow-y-auto", dark ? "divide-slate-700/50" : "divide-slate-100")}>
            {data.recentAlerts.slice(0, 5).map((alert, i) => (
              <div key={i} className={cn("px-3 py-1.5 flex items-center gap-2", dark ? "hover:bg-slate-700/30" : "hover:bg-red-50/50")}>
                <ShieldAlert className={cn("h-3 w-3 shrink-0", dark ? "text-red-400" : "text-red-500")} />
                <span className={cn("text-[10px] truncate", dark ? "text-white" : "text-slate-700")}>{alert.findingType}</span>
                <span className={cn("text-[10px] shrink-0", dark ? "text-slate-500" : "text-slate-400")}>{alert.workspaceName}</span>
                <span className={cn("text-[10px] shrink-0 ml-auto", dark ? "text-slate-600" : "text-slate-400")}>{timeAgo(alert.detectedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
