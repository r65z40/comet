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
    const interval = setInterval(fetchAlerts, 90_000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[100px]">
        <RefreshCw className={cn("animate-spin", dark ? "h-6 w-6 text-slate-500" : "h-5 w-5 text-slate-300")} />
      </div>
    );
  }

  if (error === "no_data") {
    return (
      <div className={cn("flex items-center justify-center h-full p-4", dark ? "text-sm text-slate-500" : "text-xs text-slate-400")}>
        Emsisoft non configuré
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center h-full p-4", dark ? "text-sm text-red-400" : "text-xs text-red-500")}>
        Erreur Emsisoft
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full py-6 gap-2", dark ? "text-sm text-slate-500" : "text-xs text-slate-400")}>
        <ShieldCheck className={cn("opacity-30", dark ? "h-10 w-10" : "h-8 w-8")} />
        Aucune alerte récente
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
              dark ? "px-4 py-3 hover:bg-slate-700/30" : "px-3 py-2 hover:bg-slate-50",
              isCritical && (dark ? "bg-red-500/5" : "bg-red-50/50"),
            )}>
              <div className={cn("flex items-start", dark ? "gap-3" : "gap-2")}>
                <div className={cn(
                  "rounded flex items-center justify-center shrink-0 mt-0.5",
                  dark ? "h-7 w-7" : "h-5 w-5",
                  isMalware || isCritical ? (dark ? "bg-red-900/50" : "bg-red-100") : (dark ? "bg-amber-900/40" : "bg-amber-100"),
                )}>
                  {isMalware || isCritical ? (
                    <Bug className={cn(dark ? "h-4 w-4 text-red-400" : "h-3 w-3 text-red-500")} />
                  ) : (
                    <ShieldAlert className={cn(dark ? "h-4 w-4 text-amber-400" : "h-3 w-3 text-amber-500")} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-medium truncate",
                    dark
                      ? (isMalware || isCritical ? "text-sm text-red-300" : "text-sm text-white")
                      : (isMalware || isCritical ? "text-xs text-red-800" : "text-xs text-slate-800"),
                  )}>{title}</p>
                  <div className={cn("flex items-center mt-0.5 flex-wrap", dark ? "gap-2" : "gap-1.5")}>
                    {severity && (
                      <span className={cn(
                        "font-bold uppercase rounded",
                        dark ? "text-[10px] px-1.5 py-0.5" : "text-[9px] px-1 py-0.5",
                        isCritical
                          ? (dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700")
                          : isMedium
                            ? (dark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")
                            : (dark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"),
                      )}>{severity}</span>
                    )}
                    {findingType && (
                      <span className={cn(
                        "font-medium rounded",
                        dark ? "text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-300" : "text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500",
                      )}>{findingType}</span>
                    )}
                    {status && (
                      <span className={cn(
                        "rounded",
                        dark ? "text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400" : "text-[9px] px-1 py-0.5 bg-slate-50 text-slate-500",
                      )}>{status}</span>
                    )}
                  </div>
                  <div className={cn("flex items-center mt-0.5 flex-wrap", dark ? "gap-2" : "gap-1.5")}>
                    {computer && (
                      <span className={cn(
                        "inline-flex items-center",
                        dark ? "gap-1 text-xs text-slate-400" : "gap-0.5 text-[10px] text-slate-500",
                      )}>
                        <Monitor className={cn(dark ? "h-3.5 w-3.5" : "h-2.5 w-2.5")} /> {computer}
                      </span>
                    )}
                    {wsName && (
                      <span className={cn(dark ? "text-[10px] text-slate-600" : "text-[9px] text-slate-400")}>
                        {wsName}
                      </span>
                    )}
                  </div>
                  {path && (
                    <p className={cn(
                      "mt-0.5 truncate font-mono",
                      dark ? "text-[10px] text-slate-600" : "text-[9px] text-slate-400",
                    )} title={path}>
                      {path}
                    </p>
                  )}
                  {involvedDevices.length > 0 && (
                    <div className={cn("flex items-center mt-1 flex-wrap", dark ? "gap-1.5" : "gap-1")}>
                      {involvedDevices.slice(0, 3).map((name, j) => (
                        <span key={j} className={cn(
                          "inline-flex items-center rounded",
                          dark
                            ? "gap-1 text-[10px] px-1.5 py-0.5 bg-slate-700/60 text-slate-400"
                            : "gap-0.5 text-[9px] px-1 py-0.5 bg-slate-100 text-slate-500",
                        )}>
                          <Server className={cn(dark ? "h-3 w-3" : "h-2 w-2")} /> {name}
                        </span>
                      ))}
                      {involvedDevices.length > 3 && (
                        <span className={cn(dark ? "text-[10px] text-slate-600" : "text-[9px] text-slate-400")}>
                          +{involvedDevices.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {dateStr && (
                    <>
                      <p className={cn("font-medium", dark ? "text-xs text-slate-400" : "text-[10px] text-slate-500")}>{timeAgo(dateStr)}</p>
                      <p className={cn(dark ? "text-[10px] text-slate-600" : "text-[9px] text-slate-400")}>{formatShortDate(dateStr)} {formatTime(dateStr)}</p>
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
