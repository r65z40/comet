"use client";

import { useEffect, useState, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, Router, Monitor, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OmadaSummary {
  enabled: boolean;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  siteCount: number;
  sites: {
    id: string;
    name: string;
    devices: number;
    online: number;
    offline: number;
  }[];
  devices: {
    mac: string;
    name: string;
    type: string;
    model: string;
    ip: string;
    status: number;
    statusCategory: number;
    cpuUtil: number;
    memUtil: number;
    clientNum: number;
    site: string;
    lastSeen: number;
  }[];
}

function deviceTypeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("ap") || t.includes("eap")) return Wifi;
  if (t.includes("gateway") || t.includes("router")) return Router;
  return Monitor;
}

function deviceTypeLabel(type: string) {
  const t = type.toLowerCase();
  if (t.includes("ap") || t.includes("eap")) return "AP";
  if (t.includes("gateway") || t.includes("router")) return "Routeur";
  if (t.includes("switch")) return "Switch";
  return type;
}

function timeAgo(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function OmadaWidget({ dark = false }: { dark?: boolean }) {
  const [data, setData] = useState<OmadaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/omada");
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
    const interval = setInterval(fetchData, 60_000);
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
        <p className="text-xs text-center">Omada non configuré.<br />Ajoutez vos identifiants dans Paramètres &gt; Intégrations.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full p-4 gap-3", dark ? "text-red-400" : "text-red-500")}>
        <p className={cn(dark ? "text-sm" : "text-xs")}>Erreur de connexion Omada</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetchData(); }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
            dark ? "bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm min-h-[44px]" : "bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs",
          )}
        >
          <RefreshCw className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className={cn("grid grid-cols-3 gap-1 p-2 border-b", dark ? "border-slate-700" : "border-slate-100")}>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <Building2 className={cn("h-4 w-4 mb-0.5", dark ? "text-blue-400" : "text-blue-500")} />
          <span className={cn("text-lg font-bold leading-none", dark ? "text-blue-400" : "text-blue-600")}>{data.siteCount}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>Sites</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <Wifi className={cn("h-4 w-4 mb-0.5", dark ? "text-emerald-400" : "text-emerald-500")} />
          <span className={cn("text-lg font-bold leading-none", dark ? "text-emerald-400" : "text-emerald-600")}>{data.onlineDevices}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>En ligne</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg">
          <WifiOff className={cn("h-4 w-4 mb-0.5", data.offlineDevices > 0 ? (dark ? "text-red-400" : "text-red-500") : (dark ? "text-slate-600" : "text-slate-300"))} />
          <span className={cn("text-lg font-bold leading-none", data.offlineDevices > 0 ? (dark ? "text-red-400" : "text-red-600") : (dark ? "text-slate-500" : "text-slate-400"))}>{data.offlineDevices}</span>
          <span className={cn("text-[9px]", dark ? "text-slate-500" : "text-slate-400")}>Hors ligne</span>
        </div>
      </div>

      {/* Device list */}
      <div className={cn("flex-1 overflow-y-auto", dark && "scrollbar-touch")}>
        {data.devices.length === 0 ? (
          <div className={cn("flex flex-col items-center justify-center h-full py-6 gap-2", dark ? "text-slate-500" : "text-slate-400")}>
            <Wifi className="h-8 w-8 opacity-30" />
            <p className="text-xs">Aucun appareil</p>
          </div>
        ) : (
          <div className={cn("divide-y", dark ? "divide-slate-700/50" : "divide-slate-100")}>
            {data.devices.map((device) => {
              const isOnline = device.statusCategory === 1;
              const Icon = deviceTypeIcon(device.type);
              return (
                <div key={device.mac} className={cn(
                  "px-3 py-2",
                  dark ? "hover:bg-slate-700/30" : "hover:bg-slate-50",
                  !isOnline && (dark ? "bg-red-500/5" : "bg-red-50/50"),
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        isOnline ? "bg-emerald-400" : "bg-red-400",
                      )} />
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", dark ? "text-slate-500" : "text-slate-400")} />
                      <span className={cn("text-xs font-medium truncate", dark ? "text-white" : "text-slate-900")}>{device.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                        isOnline
                          ? (dark ? "bg-emerald-900/40 text-emerald-400" : "bg-emerald-100 text-emerald-700")
                          : (dark ? "bg-red-900/40 text-red-400" : "bg-red-100 text-red-700"),
                      )}>
                        {isOnline ? "En ligne" : "Hors ligne"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1 ml-7">
                    <span className={cn("text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>
                      {deviceTypeLabel(device.type)} {device.model && `• ${device.model}`}
                    </span>
                    {device.ip && (
                      <span className={cn("text-[10px] font-mono", dark ? "text-slate-600" : "text-slate-400")}>
                        {device.ip}
                      </span>
                    )}
                    {isOnline && device.clientNum > 0 && (
                      <span className={cn("text-[10px]", dark ? "text-blue-400" : "text-blue-600")}>
                        {device.clientNum} client{device.clientNum > 1 ? "s" : ""}
                      </span>
                    )}
                    {!isOnline && device.lastSeen > 0 && (
                      <span className={cn("text-[10px]", dark ? "text-red-400/70" : "text-red-400")}>
                        {timeAgo(device.lastSeen)}
                      </span>
                    )}
                  </div>
                  {device.site && (
                    <div className="ml-7 mt-0.5">
                      <span className={cn("text-[9px]", dark ? "text-slate-600" : "text-slate-400")}>{device.site}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
