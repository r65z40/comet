"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AlertTriangle, X, Volume2, VolumeX, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CriticalAlert {
  id: string;
  source: "atera" | "oxibox" | "emsisoft" | "omada";
  title: string;
  detail: string;
  severity: string;
  timestamp: number;
}

function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Two-tone urgent beep
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, now + i * 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 0.15);
      osc.start(now + i * 0.4);
      osc.stop(now + i * 0.4 + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "square";
      osc2.frequency.value = 660;
      gain2.gain.setValueAtTime(0.15, now + i * 0.4 + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + i * 0.4 + 0.3);
      osc2.start(now + i * 0.4 + 0.15);
      osc2.stop(now + i * 0.4 + 0.3);
    }

    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

export default function CriticalAlertOverlay({ dark }: { dark?: boolean }) {
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [minimized, setMinimized] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);
  const minimizeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    try {
      const saved = localStorage.getItem("comet_alert_sound");
      if (saved === "false") setSoundEnabled(false);
    } catch {}
  }, []);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("comet_alert_sound", String(next)); } catch {}
      return next;
    });
  }

  const scheduleMinimize = useCallback((alertId: string) => {
    if (minimizeTimersRef.current.has(alertId)) return;
    const timer = setTimeout(() => {
      setMinimized((prev) => new Set(prev).add(alertId));
      minimizeTimersRef.current.delete(alertId);
    }, 30_000);
    minimizeTimersRef.current.set(alertId, timer);
  }, []);

  useEffect(() => {
    return () => {
      minimizeTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const checkAlerts = useCallback(async () => {
    const newAlerts: CriticalAlert[] = [];

    // Check Atera
    try {
      const res = await fetch("/api/atera/alerts?limit=50");
      if (res.ok) {
        const data = await res.json();
        for (const a of (data.alerts || [])) {
          if (a.severity === "Critical") {
            newAlerts.push({
              id: `atera-${a.id}`,
              source: "atera",
              title: a.title,
              detail: [a.deviceName, a.customerName].filter(Boolean).join(" — "),
              severity: "Critical",
              timestamp: a.created ? new Date(a.created).getTime() : Date.now(),
            });
          }
        }
      }
    } catch {}

    // Check Emsisoft
    try {
      const res = await fetch("/api/emsisoft/incidents?status=open");
      if (res.ok) {
        const data = await res.json();
        for (const i of (data.incidents || [])) {
          if (i.severity === "critical" || i.severity === "high") {
            newAlerts.push({
              id: `emsisoft-${i.id}`,
              source: "emsisoft",
              title: i.title,
              detail: [i.deviceName, i.type].filter(Boolean).join(" — "),
              severity: i.severity,
              timestamp: i.detectedAt ? new Date(i.detectedAt).getTime() : Date.now(),
            });
          }
        }
      }
    } catch {}

    // Check Oxibox
    try {
      const res = await fetch("/api/oxibox/status?limit=200&skip=0");
      if (res.ok) {
        const data = await res.json();
        const accounts = data.data || (data.organizationId ? [data] : []);
        for (const a of accounts) {
          if (a.status === "ERROR") {
            newAlerts.push({
              id: `oxibox-${a.organizationId}`,
              source: "oxibox",
              title: `Sauvegarde en erreur`,
              detail: a.organizationId,
              severity: "ERROR",
              timestamp: Date.now(),
            });
          }
        }
      }
    } catch {}

    // Check Omada
    try {
      const res = await fetch("/api/omada");
      if (res.ok) {
        const data = await res.json();
        if (data.enabled && data.offlineAlerts) {
          for (const d of data.offlineAlerts) {
            newAlerts.push({
              id: `omada-${d.mac}`,
              source: "omada",
              title: `Appareil hors ligne : ${d.name}`,
              detail: [d.type, d.site].filter(Boolean).join(" — "),
              severity: "Critical",
              timestamp: d.lastSeen || Date.now(),
            });
          }
        }
      }
    } catch {}

    // Detect truly new alerts (not seen before)
    const unseenAlerts: CriticalAlert[] = [];
    for (const alert of newAlerts) {
      if (!seenIdsRef.current.has(alert.id)) {
        seenIdsRef.current.add(alert.id);
        if (!initialLoadRef.current) {
          unseenAlerts.push(alert);
        }
      }
    }
    initialLoadRef.current = false;

    if (unseenAlerts.length > 0) {
      setAlerts((prev) => [...unseenAlerts, ...prev]);
      for (const a of unseenAlerts) scheduleMinimize(a.id);
      if (soundEnabled) playAlertSound();
    }
  }, [soundEnabled, scheduleMinimize]);

  useEffect(() => {
    const delay = setTimeout(() => {
      checkAlerts();
    }, 5_000);
    const interval = setInterval(checkAlerts, 60_000);
    return () => { clearTimeout(delay); clearInterval(interval); };
  }, [checkAlerts]);

  function acknowledge(alertId: string) {
    setDismissed((prev) => new Set(prev).add(alertId));
    const timer = minimizeTimersRef.current.get(alertId);
    if (timer) { clearTimeout(timer); minimizeTimersRef.current.delete(alertId); }
  }

  function acknowledgeAll(ids: string[]) {
    setDismissed((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => n.add(id));
      return n;
    });
    ids.forEach((id) => {
      const timer = minimizeTimersRef.current.get(id);
      if (timer) { clearTimeout(timer); minimizeTimersRef.current.delete(id); }
    });
  }

  const freshAlerts = alerts.filter((a) => !dismissed.has(a.id) && !minimized.has(a.id));
  const minimizedAlerts = alerts.filter((a) => !dismissed.has(a.id) && minimized.has(a.id));

  const sourceBadge = (source: CriticalAlert["source"]) => (
    <span className={cn(
      "font-bold uppercase rounded",
      dark ? "text-xs px-2 py-1" : "text-[10px] px-1.5 py-0.5",
      source === "atera"
        ? (dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700")
        : source === "emsisoft"
          ? (dark ? "bg-purple-500/20 text-purple-400" : "bg-purple-100 text-purple-700")
          : source === "omada"
            ? (dark ? "bg-cyan-500/20 text-cyan-400" : "bg-cyan-100 text-cyan-700")
            : (dark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700"),
    )}>
      {source === "atera" ? "Atera" : source === "emsisoft" ? "Emsisoft" : source === "omada" ? "Omada" : "Oxibox"}
    </span>
  );

  const sourceLabel = (source: CriticalAlert["source"]) =>
    source === "atera" ? "Atera" : source === "emsisoft" ? "Emsisoft" : source === "omada" ? "Omada" : "Oxibox";

  return (
    <>
      {/* Sound toggle */}
      <button
        onClick={toggleSound}
        className={cn(
          "fixed z-[9998] rounded-full transition-colors",
          minimizedAlerts.length > 0 ? "bottom-16 right-4" : "bottom-4 right-4",
          dark
            ? "p-3.5 min-h-[48px] min-w-[48px] flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400"
            : "p-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 shadow-sm",
        )}
        title={soundEnabled ? "Son activé" : "Son désactivé"}
      >
        {soundEnabled
          ? <Volume2 className={cn(dark ? "h-6 w-6" : "h-4 w-4")} />
          : <VolumeX className={cn("text-red-400", dark ? "h-6 w-6" : "h-4 w-4")} />}
      </button>

      {/* Full overlay for fresh alerts (first 30s) */}
      {freshAlerts.length > 0 && (
        <div className="fixed inset-0 z-[9995] bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className={cn(
            "pointer-events-auto w-full mx-4 animate-in fade-in zoom-in duration-300",
            dark ? "max-w-2xl" : "max-w-lg",
          )}>
            <div className={cn(
              "rounded-2xl border-2 shadow-2xl overflow-hidden",
              dark ? "bg-slate-900 border-red-500/50" : "bg-white border-red-200",
            )}>
              {/* Red pulsing header */}
              <div className={cn(
                "bg-red-600 flex items-center gap-3 animate-pulse",
                dark ? "px-8 py-5" : "px-6 py-4",
              )}>
                <AlertTriangle className={cn("text-white shrink-0", dark ? "h-9 w-9" : "h-7 w-7")} />
                <div className="flex-1">
                  <h2 className={cn("font-bold text-white", dark ? "text-2xl" : "text-lg")}>Alerte Critique</h2>
                  <p className={cn("text-red-200", dark ? "text-base" : "text-sm")}>{freshAlerts.length} alerte{freshAlerts.length > 1 ? "s" : ""} critique{freshAlerts.length > 1 ? "s" : ""}</p>
                </div>
                <button
                  onClick={() => acknowledgeAll(freshAlerts.map((a) => a.id))}
                  className={cn(
                    "rounded-lg bg-red-700/50 hover:bg-red-700 text-white transition-colors",
                    dark ? "p-3 min-h-[48px] min-w-[48px] flex items-center justify-center" : "p-1.5",
                  )}
                >
                  <X className={cn(dark ? "h-7 w-7" : "h-5 w-5")} />
                </button>
              </div>

              {/* Alert list */}
              <div className={cn(
                "overflow-y-auto divide-y",
                dark ? "max-h-96 divide-slate-700" : "max-h-64 divide-slate-100 dark:divide-slate-700",
              )}>
                {freshAlerts.map((alert) => (
                  <div key={alert.id} className={cn(
                    "flex items-start",
                    dark ? "px-8 py-4 gap-4 hover:bg-slate-800" : "px-6 py-3 gap-3 hover:bg-red-50/50",
                  )}>
                    <div className={cn(
                      "mt-0.5 rounded-full shrink-0 animate-pulse",
                      dark ? "w-3 h-3" : "w-2 h-2",
                      alert.source === "atera" ? "bg-red-500" : alert.source === "emsisoft" ? "bg-purple-500" : alert.source === "omada" ? "bg-cyan-500" : "bg-orange-500",
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {sourceBadge(alert.source)}
                      </div>
                      <p className={cn(
                        "font-medium mt-1 truncate",
                        dark ? "text-base text-white" : "text-sm text-slate-900",
                      )}>{alert.title}</p>
                      {alert.detail && <p className={cn(
                        "mt-0.5 truncate",
                        dark ? "text-sm text-slate-400" : "text-xs text-slate-500",
                      )}>{alert.detail}</p>}
                    </div>
                    <button
                      onClick={() => acknowledge(alert.id)}
                      className={cn(
                        "shrink-0",
                        dark
                          ? "p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
                          : "p-1 rounded text-slate-300 hover:text-slate-500",
                      )}
                      title="Acquitter"
                    >
                      <CheckCircle2 className={cn(dark ? "h-6 w-6" : "h-4 w-4")} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className={cn(
                "border-t flex items-center justify-between",
                dark ? "px-8 py-4 border-slate-700 bg-slate-800/50" : "px-6 py-3 border-slate-100 bg-slate-50",
              )}>
                <p className={cn(dark ? "text-sm text-slate-500" : "text-xs text-slate-400")}>
                  Se réduit en bas dans 30s
                </p>
                <button
                  onClick={() => acknowledgeAll(freshAlerts.map((a) => a.id))}
                  className={cn(
                    "font-medium text-red-600 hover:text-red-700",
                    dark ? "text-sm px-4 py-2 min-h-[44px] rounded-lg hover:bg-red-500/10" : "text-xs",
                  )}
                >
                  Tout acquitter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minimized bottom bar for alerts past 30s — requires acknowledgment */}
      {minimizedAlerts.length > 0 && (
        <div className={cn(
          "fixed bottom-0 left-0 right-0 z-[9994] border-t shadow-lg transition-all",
          dark ? "bg-slate-800/95 border-red-500/30 backdrop-blur-sm" : "bg-white/95 border-red-200 backdrop-blur-sm",
        )}>
          <div className={cn(
            "max-w-screen-xl mx-auto flex items-center",
            dark ? "px-6 py-3 gap-4" : "px-4 py-2 gap-3",
          )}>
            <div className={cn("flex items-center shrink-0", dark ? "gap-3" : "gap-2")}>
              <AlertTriangle className={cn("text-red-500 animate-pulse", dark ? "h-6 w-6" : "h-4 w-4")} />
              <span className={cn(
                "font-bold",
                dark ? "text-base text-red-400" : "text-xs text-red-600",
              )}>
                {minimizedAlerts.length} alerte{minimizedAlerts.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className={cn(
              "flex-1 overflow-x-auto flex items-center min-w-0",
              dark ? "gap-3" : "gap-2",
            )}>
              {minimizedAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-center shrink-0",
                    dark
                      ? "gap-3 px-4 py-2.5 rounded-xl bg-slate-700/60 max-w-sm"
                      : "gap-2 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 max-w-xs",
                  )}
                >
                  <div className={cn(
                    "rounded-full shrink-0 animate-pulse",
                    dark ? "w-2.5 h-2.5" : "w-1.5 h-1.5",
                    alert.source === "atera" ? "bg-red-500" : alert.source === "emsisoft" ? "bg-purple-500" : alert.source === "omada" ? "bg-cyan-500" : "bg-orange-500",
                  )} />
                  <span className={cn(
                    "font-bold uppercase shrink-0",
                    dark ? "text-xs text-slate-400" : "text-[10px] text-slate-500",
                  )}>
                    {sourceLabel(alert.source)}
                  </span>
                  <span className={cn(
                    "truncate",
                    dark ? "text-sm text-slate-300" : "text-xs text-slate-700",
                  )}>
                    {alert.title}
                  </span>
                  <button
                    onClick={() => acknowledge(alert.id)}
                    className={cn(
                      "shrink-0 flex items-center font-semibold transition-colors",
                      dark
                        ? "gap-2 px-3 py-1.5 rounded-lg text-sm min-h-[40px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        : "gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                    )}
                    title="Acquitter"
                  >
                    <CheckCircle2 className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                    OK
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => acknowledgeAll(minimizedAlerts.map((a) => a.id))}
              className={cn(
                "shrink-0 flex items-center font-semibold transition-colors",
                dark
                  ? "gap-2 px-5 py-3 rounded-xl text-base min-h-[48px] bg-emerald-600/80 text-white hover:bg-emerald-600"
                  : "gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-700",
              )}
            >
              <CheckCircle2 className={cn(dark ? "h-5 w-5" : "h-3.5 w-3.5")} />
              Tout acquitter
            </button>
          </div>
        </div>
      )}
    </>
  );
}
