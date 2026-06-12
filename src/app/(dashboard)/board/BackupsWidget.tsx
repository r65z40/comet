"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Machine {
  id: string;
  status: "OK" | "ALERT" | "ERROR";
  ongoingBackup: boolean;
}

interface OxiboxAccount {
  organizationId: string;
  status: "OK" | "ALERT" | "ERROR";
  ongoingBackup: boolean;
  machines: Machine[];
}

interface CometClient {
  id: string;
  name: string;
  oxiboxId: string | null;
  logoUrl: string | null;
}

interface CloudUsage {
  allocatedQuota: number;
  currentUsage: number;
}

const STATUS_ICON = {
  OK: CheckCircle,
  ALERT: AlertTriangle,
  ERROR: XCircle,
};

const STATUS_COLOR = {
  OK: { dot: "bg-emerald-500", text: "text-emerald-500", bg: "bg-emerald-500/20" },
  ALERT: { dot: "bg-amber-500", text: "text-amber-500", bg: "bg-amber-500/20" },
  ERROR: { dot: "bg-red-500", text: "text-red-500", bg: "bg-red-500/20" },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

export default function BackupsWidget({ dark }: { dark?: boolean }) {
  const [accounts, setAccounts] = useState<OxiboxAccount[]>([]);
  const [clients, setClients] = useState<CometClient[]>([]);
  const [usages, setUsages] = useState<Record<string, CloudUsage>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, clientRes] = await Promise.all([
        fetch("/api/oxibox/status?limit=200&skip=0"),
        fetch("/api/clients?limit=9999"),
      ]);
      if (statusRes.ok) {
        const sd = await statusRes.json();
        const accs: OxiboxAccount[] = sd.data || (sd.organizationId ? [sd] : []);
        setAccounts(accs);
        for (const a of accs) {
          fetch(`/api/oxibox/usage?orgId=${encodeURIComponent(a.organizationId)}`)
            .then((r) => r.ok ? r.json() : null)
            .then((u) => { if (u) setUsages((prev) => ({ ...prev, [a.organizationId]: u })); })
            .catch(() => {});
        }
      }
      if (clientRes.ok) {
        const cd = await clientRes.json();
        setClients((cd.clients || cd || []).map((c: CometClient) => ({ id: c.id, name: c.name, oxiboxId: c.oxiboxId, logoUrl: c.logoUrl })));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center h-full", dark ? "text-slate-500" : "text-slate-400")}>
        <RefreshCw className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full text-xs", dark ? "text-slate-500" : "text-slate-400")}>
        Aucun compte Oxibox
      </div>
    );
  }

  const clientByOxiboxId = new Map(clients.filter((c) => c.oxiboxId).map((c) => [c.oxiboxId!, c]));
  const stats = { ok: 0, alert: 0, error: 0 };
  accounts.forEach((a) => { stats[a.status.toLowerCase() as "ok" | "alert" | "error"]++; });

  const sorted = [...accounts].sort((a, b) => {
    const order = { ERROR: 0, ALERT: 1, OK: 2 };
    return order[a.status] - order[b.status] || a.organizationId.localeCompare(b.organizationId);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary bar */}
      <div className={cn("flex items-center gap-3 px-3 py-2 border-b shrink-0", dark ? "border-slate-700" : "border-slate-100")}>
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span className={cn("text-xs font-bold", dark ? "text-emerald-400" : "text-emerald-600")}>{stats.ok}</span>
        </div>
        {stats.alert > 0 && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className={cn("text-xs font-bold", dark ? "text-amber-400" : "text-amber-600")}>{stats.alert}</span>
          </div>
        )}
        {stats.error > 0 && (
          <div className="flex items-center gap-1 animate-pulse">
            <XCircle className="h-3.5 w-3.5 text-red-500" />
            <span className={cn("text-xs font-bold", dark ? "text-red-400" : "text-red-600")}>{stats.error}</span>
          </div>
        )}
        <span className={cn("text-[10px] ml-auto", dark ? "text-slate-500" : "text-slate-400")}>
          {accounts.length} compte{accounts.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Account list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((account) => {
          const linked = clientByOxiboxId.get(account.organizationId);
          const usage = usages[account.organizationId];
          const pct = usage ? Math.round((usage.currentUsage / usage.allocatedQuota) * 100) : null;
          const sc = STATUS_COLOR[account.status];
          const Icon = STATUS_ICON[account.status];

          return (
            <div
              key={account.organizationId}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 border-b",
                dark ? "border-slate-700/50 hover:bg-slate-700/30" : "border-slate-50 hover:bg-slate-50",
                account.status === "ERROR" && (dark ? "bg-red-500/10 animate-pulse" : "bg-red-50 animate-pulse"),
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", sc.dot)} />

              {linked?.logoUrl ? (
                <img src={linked.logoUrl} alt="" className="h-5 w-5 rounded object-cover shrink-0" />
              ) : null}

              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-medium truncate", dark ? "text-slate-200" : "text-slate-700")}>
                  {linked ? linked.name : account.organizationId}
                </p>
              </div>

              {pct !== null && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={cn("w-12 h-1.5 rounded-full overflow-hidden", dark ? "bg-slate-700" : "bg-slate-100")}>
                    <div
                      className={cn("h-full rounded-full", pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className={cn("text-[9px] w-7 text-right tabular-nums", dark ? "text-slate-500" : "text-slate-400")}>{pct}%</span>
                </div>
              )}

              <div className="flex items-center gap-1 shrink-0">
                <Server className={cn("h-2.5 w-2.5", dark ? "text-slate-600" : "text-slate-300")} />
                <span className={cn("text-[10px]", dark ? "text-slate-500" : "text-slate-400")}>{account.machines.length}</span>
              </div>

              {account.ongoingBackup && (
                <RefreshCw className="h-2.5 w-2.5 text-purple-500 animate-spin shrink-0" />
              )}

              <Icon className={cn("h-3 w-3 shrink-0", sc.text)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
