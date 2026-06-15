"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldAlert, ShieldCheck, RefreshCw, Monitor, Bug, Server } from "lucide-react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Finding = Record<string, any>;

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function findDate(f: Finding): string {
  const direct = f.timestamp || f.detectedAt || f.createdAt || f.changedAt
    || f.Timestamp || f.DetectedAt || f.CreatedAt || f.ChangedAt
    || f.date || f.Date || f.lastSeen || "";
  if (direct) return direct;
  for (const v of Object.values(f)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v;
  }
  return "";
}

export default function EmisoftAlertsWidget({ dark = false }: { dark?: boolean }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      // Get workspaces first
      const wsRes = await fetch("/api/emsisoft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "workspaces" }),
      });
      if (!wsRes.ok) { setError("api"); return; }
      const wsData = await wsRes.json();
      if (wsData.error || !wsData.workspaces?.length) { setError("no_data"); return; }

      // Fetch findings from first workspace (most active)
      const sorted = [...wsData.workspaces].sort(
        (a: Finding, b: Finding) => (b.findingsLastMonth || 0) - (a.findingsLastMonth || 0),
      );

      const allFindings: Finding[] = [];
      // Fetch from top 3 workspaces max to stay fast
      for (const ws of sorted.slice(0, 3)) {
        try {
          const res = await fetch(`/api/emsisoft/status?workspaceId=${ws.guid || ws.id}`);
          if (res.ok) {
            const data = await res.json();
            const items = data.findings || [];
            allFindings.push(...items.map((f: Finding) => ({ ...f, _wsName: ws.name })));
          }
        } catch {}
      }

      // Sort by date desc
      allFindings.sort((a, b) => {
        const dA = new Date(findDate(a)).getTime() || 0;
        const dB = new Date(findDate(b)).getTime() || 0;
        return dB - dA;
      });

      setFindings(allFindings.slice(0, 15));
      setError(null);
    } catch {
      setError("fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 90_000); // refresh every 90s
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[100px]">
        <RefreshCw className={cn("h-5 w-5 animate-spin", dark ? "text-slate-500" : "text-slate-300")} />
      </div>
    );
  }

  if (error === "no_data") {
    return (
      <div className={cn("flex items-center justify-center h-full p-4", dark ? "text-slate-500" : "text-slate-400")}>
        <p className="text-xs text-center">Emsisoft non configuré</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center h-full p-4", dark ? "text-red-400" : "text-red-500")}>
        <p className="text-xs">Erreur Emsisoft</p>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-6 gap-2", dark ? "text-slate-500" : "text-slate-400")}>
        <ShieldCheck className="h-8 w-8 opacity-30" />
        <p className="text-xs">Aucune alerte récente</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className={cn("flex-1 overflow-y-auto divide-y", dark ? "divide-slate-700/50" : "divide-slate-100")}>
        {findings.map((f, i) => {
          const title = f.threatName || f.malwareName || f.detectionName || f.name || f.title || f.findingType || f.type || "Alerte";
          const computer = f.computerName || f.deviceName || "";
          const findingType = f.findingType || f.type || "";
          const severity = f.severity || f.Severity || f.risk || f.riskLevel || "";
          const status = f.status || f.actionTaken || f.Action || "";
          const path = f.path || f.filePath || f.location || f.FilePath || "";
          const wsName = f._wsName || "";
          const dateStr = findDate(f);
          const isMalware = /malware|trojan|virus|worm|ransom|exploit|pup|adware/i.test(title);

          const sevNorm = String(severity).toLowerCase();
          const isCritical = sevNorm === "critical" || sevNorm === "high" || sevNorm === "danger";
          const isMedium = sevNorm === "medium" || sevNorm === "moderate";

          const involvedDevices: string[] = [];
          if (Array.isArray(f.involvedDevices)) {
            for (const d of f.involvedDevices) {
              if (typeof d === "string") involvedDevices.push(d);
              else if (d?.name || d?.computerName) involvedDevices.push(d.name || d.computerName);
            }
          }

          return (
            <div key={f.guid || f.id || i} className={cn(
              "px-3 py-2",
              dark ? "hover:bg-slate-700/30" : "hover:bg-slate-50",
              isCritical && (dark ? "bg-red-500/5" : "bg-red-50/50"),
            )}>
              <div className="flex items-start gap-2">
                <div className={cn(
                  "h-5 w-5 rounded flex items-center justify-center shrink-0 mt-0.5",
                  isMalware || isCritical ? (dark ? "bg-red-900/50" : "bg-red-100") : (dark ? "bg-amber-900/40" : "bg-amber-100"),
                )}>
                  {isMalware || isCritical ? (
                    <Bug className={cn("h-3 w-3", dark ? "text-red-400" : "text-red-500")} />
                  ) : (
                    <ShieldAlert className={cn("h-3 w-3", dark ? "text-amber-400" : "text-amber-500")} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium truncate", dark ? (isMalware || isCritical ? "text-red-300" : "text-white") : (isMalware || isCritical ? "text-red-800" : "text-slate-800"))}>{title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {severity && (
                      <span className={cn(
                        "text-[9px] font-bold uppercase rounded px-1 py-0.5",
                        isCritical
                          ? (dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700")
                          : isMedium
                            ? (dark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")
                            : (dark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"),
                      )}>{severity}</span>
                    )}
                    {findingType && (
                      <span className={cn(
                        "text-[9px] font-medium rounded px-1 py-0.5",
                        dark ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-500",
                      )}>{findingType}</span>
                    )}
                    {status && (
                      <span className={cn(
                        "text-[9px] rounded px-1 py-0.5",
                        dark ? "bg-slate-700/60 text-slate-400" : "bg-slate-50 text-slate-500",
                      )}>{status}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {computer && (
                      <span className={cn("inline-flex items-center gap-0.5 text-[10px]", dark ? "text-slate-400" : "text-slate-500")}>
                        <Monitor className="h-2.5 w-2.5" /> {computer}
                      </span>
                    )}
                    {wsName && (
                      <span className={cn("text-[9px]", dark ? "text-slate-600" : "text-slate-400")}>
                        {wsName}
                      </span>
                    )}
                  </div>
                  {path && (
                    <p className={cn("text-[9px] mt-0.5 truncate font-mono", dark ? "text-slate-600" : "text-slate-400")} title={path}>
                      {path}
                    </p>
                  )}
                  {involvedDevices.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {involvedDevices.slice(0, 3).map((name, j) => (
                        <span key={j} className={cn(
                          "inline-flex items-center gap-0.5 text-[9px] rounded px-1 py-0.5",
                          dark ? "bg-slate-700/60 text-slate-400" : "bg-slate-100 text-slate-500",
                        )}>
                          <Server className="h-2 w-2" /> {name}
                        </span>
                      ))}
                      {involvedDevices.length > 3 && (
                        <span className={cn("text-[9px]", dark ? "text-slate-600" : "text-slate-400")}>
                          +{involvedDevices.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {dateStr && (
                    <>
                      <p className={cn("text-[10px] font-medium", dark ? "text-slate-400" : "text-slate-500")}>{timeAgo(dateStr)}</p>
                      <p className={cn("text-[9px]", dark ? "text-slate-600" : "text-slate-400")}>{formatShortDate(dateStr)} {formatTime(dateStr)}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
