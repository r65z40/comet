"use client";

import { useEffect, useState } from "react";
import { usePortal } from "./layout";
import { ShieldCheck, ShieldX, ShieldAlert, Package } from "lucide-react";
import Link from "next/link";

interface Installation {
  id: string;
  status: string;
  alwaysInFleet: boolean;
  startDate: string;
  endDate: string;
  durationMonths: number;
  quantity: number;
  supplier: string | null;
  family: string | null;
  product: { id: string; name: string; code: string | null };
}

export default function PortalDashboard() {
  const { client, portalSettings } = usePortal();
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/installations")
      .then((r) => r.json())
      .then((data) => {
        setInstallations(data.installations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const primaryColor = portalSettings?.primaryColor || "#3b82f6";

  const active = installations.filter(
    (i) => !i.alwaysInFleet && (i.status === "EN_PARC" || i.status === "EN_PARC_GARANTIE")
  );
  const expired = installations.filter(
    (i) => !i.alwaysInFleet && (i.status === "HORS_PARC" || i.status === "EN_PARC_HORS_GARANTIE")
  );
  const expiringSoon = active.filter((i) => {
    const days = Math.ceil((new Date(i.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 && days <= 90;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Bienvenue, <span style={{ color: primaryColor }}>{client?.name}</span>
        </h1>
        {portalSettings?.welcomeMessage && (
          <p className="mt-1 text-sm text-slate-500">{portalSettings.welcomeMessage}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-slate-100 p-2">
              <Package className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{installations.length}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{active.length}</p>
              <p className="text-xs text-emerald-600">En parc</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <ShieldAlert className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-700">{expiringSoon.length}</p>
              <p className="text-xs text-orange-600">Expire bientôt</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <ShieldX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{expired.length}</p>
              <p className="text-xs text-red-600">Hors parc</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring soon list */}
      {expiringSoon.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            Garanties expirant dans les 90 prochains jours
          </h2>
          <div className="space-y-2">
            {expiringSoon.map((inst) => {
              const days = Math.ceil((new Date(inst.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              return (
                <div key={inst.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{inst.product.name}</p>
                    {portalSettings?.showFamily && inst.family && (
                      <p className="text-xs text-slate-400">{inst.family}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    days <= 30 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"
                  }`}>
                    {days}j restants
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick link */}
      <div className="flex gap-3">
        <Link
          href="/portal/installations"
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: primaryColor }}
        >
          Voir toutes les installations
        </Link>
        <Link
          href="/portal/report"
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Télécharger le rapport
        </Link>
      </div>
    </div>
  );
}
