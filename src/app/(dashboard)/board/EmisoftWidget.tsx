"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, ShieldAlert, ShieldOff, Wifi, WifiOff, RefreshCw, Bug } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmsisoftSummary {
  enabled: boolean;
  totalDevices: number;
  protectedDevices: number;
  atRiskDevices: number;
  offlineDevices: number;
  openIncidents: number;
  recentThreats: { deviceName: string; threat: string; detectedAt: string }[];
  workspaceCount: number;
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
      <div className={cn("grid grid-cols-4 gap-1 p-2 border-b", dark ? "border-slate-700" : "border-slate-100")}>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <Shield className={cn("h-4 w-4 mb-0.5", dark ? "text-emerald-400" : "text-emerald-500")} />
          <span className={cn("text-lg font-bold leading-none", dark ? "text-emerald-400" : "text-emerald-600")}>{data.protectedDevices}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>Protégés</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <ShieldAlert className={cn("h-4 w-4 mb-0.5", data.atRiskDevices > 0 ? (dark ? "text-red-400 animate-pulse" : "text-red-500 animate-pulse") : (dark ? "text-slate-600" : "text-slate-300"))} />
          <span className={cn("text-lg font-bold leading-none", data.atRiskDevices > 0 ? (dark ? "text-red-400" : "text-red-600") : (dark ? "text-slate-500" : "text-slate-400"))}>{data.atRiskDevices}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>À risque</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <WifiOff className={cn("h-4 w-4 mb-0.5", dark ? "text-slate-500" : "text-slate-400")} />
          <span className={cn("text-lg font-bold leading-none", dark ? "text-slate-400" : "text-slate-500")}>{data.offlineDevices}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>Hors ligne</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <Bug className={cn("h-4 w-4 mb-0.5", data.openIncidents > 0 ? (dark ? "text-amber-400 animate-pulse" : "text-amber-500 animate-pulse") : (dark ? "text-slate-600" : "text-slate-300"))} />
          <span className={cn("text-lg font-bold leading-none", data.openIncidents > 0 ? (dark ? "text-amber-400" : "text-amber-600") : (dark ? "text-slate-500" : "text-slate-400"))}>{data.openIncidents}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>Incidents</span>
        </div>
      </div>

      {/* Recent threats */}
      <div className="flex-1 overflow-y-auto">
        {data.recentThreats.length === 0 ? (
          <div className={cn("flex flex-col items-center justify-center h-full py-6 gap-2", dark ? "text-slate-500" : "text-slate-400")}>
            <Shield className="h-8 w-8 opacity-30" />
            <p className="text-xs">Aucune menace récente</p>
          </div>
        ) : (
          <div className={cn("divide-y", dark ? "divide-slate-700/50" : "divide-slate-100")}>
            {data.recentThreats.map((threat, i) => (
              <div key={i} className={cn("px-3 py-2", dark ? "hover:bg-slate-700/30" : "hover:bg-red-50/50")}>
                <div className="flex items-start gap-2">
                  <ShieldAlert className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", dark ? "text-red-400" : "text-red-500")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-900")}>{threat.threat}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-[10px] truncate", dark ? "text-slate-400" : "text-slate-500")}>{threat.deviceName}</span>
                      <span className={cn("text-[10px] shrink-0", dark ? "text-slate-600" : "text-slate-400")}>{timeAgo(threat.detectedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={cn("px-3 py-1.5 border-t flex items-center justify-between", dark ? "border-slate-700 bg-slate-800/50" : "border-slate-100 bg-slate-50/50")}>
        <div className="flex items-center gap-1.5">
          <Wifi className={cn("h-3 w-3", dark ? "text-emerald-500" : "text-emerald-400")} />
          <span className={cn("text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>
            {data.totalDevices} appareil{data.totalDevices > 1 ? "s" : ""} • {data.workspaceCount} workspace{data.workspaceCount > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
