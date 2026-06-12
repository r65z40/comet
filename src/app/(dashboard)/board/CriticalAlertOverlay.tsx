"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AlertTriangle, X, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface CriticalAlert {
  id: string;
  source: "atera" | "oxibox";
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

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
      if (soundEnabled) playAlertSound();
    }
  }, [soundEnabled]);

  useEffect(() => {
    checkAlerts();
    const interval = setInterval(checkAlerts, 60_000);
    return () => clearInterval(interval);
  }, [checkAlerts]);

  // Auto-dismiss after 30s
  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = setTimeout(() => {
      setAlerts((prev) => {
        const cutoff = Date.now() - 30_000;
        return prev.filter((a) => a.timestamp > cutoff);
      });
    }, 30_000);
    return () => clearTimeout(timer);
  }, [alerts]);

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  if (visible.length === 0) {
    return (
      <button
        onClick={toggleSound}
        className={cn(
          "fixed bottom-4 right-4 z-[9990] p-2 rounded-full transition-colors",
          dark ? "bg-slate-800 hover:bg-slate-700 text-slate-400" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 shadow-sm",
        )}
        title={soundEnabled ? "Son activé" : "Son désactivé"}
      >
        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-400" />}
      </button>
    );
  }

  return (
    <>
      {/* Sound toggle */}
      <button
        onClick={toggleSound}
        className={cn(
          "fixed bottom-4 right-4 z-[9998] p-2 rounded-full transition-colors",
          dark ? "bg-slate-800 hover:bg-slate-700 text-slate-400" : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-400 shadow-sm",
        )}
        title={soundEnabled ? "Son activé" : "Son désactivé"}
      >
        {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-red-400" />}
      </button>

      {/* Overlay backdrop */}
      <div className="fixed inset-0 z-[9995] bg-black/30 backdrop-blur-sm flex items-center justify-center pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg mx-4 animate-in fade-in zoom-in duration-300">
          <div className={cn(
            "rounded-2xl border-2 shadow-2xl overflow-hidden",
            dark ? "bg-slate-900 border-red-500/50" : "bg-white border-red-200",
          )}>
            {/* Red pulsing header */}
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3 animate-pulse">
              <AlertTriangle className="h-7 w-7 text-white shrink-0" />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-white">Alerte Critique</h2>
                <p className="text-red-200 text-sm">{visible.length} alerte{visible.length > 1 ? "s" : ""} critique{visible.length > 1 ? "s" : ""} détectée{visible.length > 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={() => setDismissed((prev) => { const n = new Set(prev); visible.forEach((a) => n.add(a.id)); return n; })}
                className="p-1.5 rounded-lg bg-red-700/50 hover:bg-red-700 text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Alert list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {visible.map((alert) => (
                <div key={alert.id} className={cn("px-6 py-3 flex items-start gap-3", dark ? "hover:bg-slate-800" : "hover:bg-red-50/50")}>
                  <div className={cn(
                    "mt-0.5 w-2 h-2 rounded-full shrink-0 animate-pulse",
                    alert.source === "atera" ? "bg-red-500" : "bg-orange-500",
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                        alert.source === "atera"
                          ? (dark ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-700")
                          : (dark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700"),
                      )}>
                        {alert.source === "atera" ? "Atera" : "Oxibox"}
                      </span>
                    </div>
                    <p className={cn("text-sm font-medium mt-1 truncate", dark ? "text-white" : "text-slate-900")}>{alert.title}</p>
                    {alert.detail && <p className={cn("text-xs mt-0.5 truncate", dark ? "text-slate-400" : "text-slate-500")}>{alert.detail}</p>}
                  </div>
                  <button
                    onClick={() => setDismissed((prev) => new Set(prev).add(alert.id))}
                    className={cn("p-1 rounded shrink-0", dark ? "text-slate-500 hover:text-slate-300" : "text-slate-300 hover:text-slate-500")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={cn("px-6 py-3 border-t flex items-center justify-between", dark ? "border-slate-700 bg-slate-800/50" : "border-slate-100 bg-slate-50")}>
              <p className={cn("text-xs", dark ? "text-slate-500" : "text-slate-400")}>
                Disparition automatique dans 30s
              </p>
              <button
                onClick={() => setDismissed((prev) => { const n = new Set(prev); visible.forEach((a) => n.add(a.id)); return n; })}
                className="text-xs font-medium text-red-600 hover:text-red-700"
              >
                Tout fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
