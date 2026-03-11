"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, ShieldCheck, ShieldX, RefreshCw, Users, Package, Clock, AlertTriangle } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, daysUntil, formatCountdown, getCountdownColor } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  type PieLabelRenderProps,
} from "recharts";

interface DashboardData {
  counts: {
    total: number;
    enGarantie: number;
    horsGarantie: number;
    renouvele: number;
    expiring30: number;
    expiring60: number;
    expiring90: number;
    totalClients: number;
    totalProducts: number;
  };
  byFamily: { name: string; value: number }[];
  bySupplier: { name: string; value: number }[];
  byMonth: { month: string; count: number }[];
  upcomingRenewals: {
    id: string;
    endDate: string;
    status: string;
    durationMonths: number;
    client: { id: string; name: string };
    product: { id: string; name: string };
  }[];
  recentlyExpired: {
    id: string;
    endDate: string;
    status: string;
    client: { id: string; name: string };
    product: { id: string; name: string };
  }[];
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316"];

function formatMonthFr(label: unknown) {
  if (typeof label !== "string") return String(label ?? "");
  const [year, m] = label.split("-");
  return `${m}/${year}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => {
        if (!r.ok) throw new Error(`Erreur ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
          <p className="text-red-400 font-medium mb-2">Erreur de chargement</p>
          <p className="text-sm text-surface-400">{error || "Données indisponibles"}</p>
          <p className="text-xs text-surface-500 mt-3">
            Si vous venez de mettre à jour, exécutez le script de migration :<br />
            <code className="text-primary-400">bash scripts/migrate-statuses.sh</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-surface-400 mt-1">Suivi des garanties et échéances</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total installations" value={data.counts.total} icon={Monitor} color="blue" href="/installations" />
        <StatCard title="En parc garantie" value={data.counts.enGarantie} icon={ShieldCheck} color="green" href="/installations?status=EN_PARC_GARANTIE" />
        <StatCard
          title="En parc sans garantie"
          value={data.counts.horsGarantie}
          icon={ShieldX}
          color="red"
          href="/installations?status=EN_PARC_HORS_GARANTIE"
        />
        <StatCard title="Renouvelés" value={data.counts.renouvele} icon={RefreshCw} color="blue" href="/installations?status=RENOUVELE" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/installations?expiring=30" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 hover:bg-red-500/20 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Expire dans 30 jours</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.counts.expiring30}</p>
        </Link>
        <Link href="/installations?expiring=60" className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 hover:bg-orange-500/20 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-400">Expire dans 60 jours</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.counts.expiring60}</p>
        </Link>
        <Link href="/installations?expiring=90" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/20 transition-colors">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Expire dans 90 jours</span>
          </div>
          <p className="text-2xl font-bold text-white">{data.counts.expiring90}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard title="Clients" value={data.counts.totalClients} icon={Users} color="blue" href="/clients" />
        <StatCard title="Produits" value={data.counts.totalProducts} icon={Package} color="blue" href="/products" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
          <h3 className="text-sm font-medium text-surface-400 mb-4">Fins de garantie par mois</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tickFormatter={formatMonthFr} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
                labelFormatter={formatMonthFr}
              />
              <Bar
                dataKey="count"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                name="Fins de garantie"
                cursor="pointer"
                onClick={(_: unknown, index: number) => {
                  const month = data.byMonth[index]?.month;
                  if (month) router.push(`/installations?month=${month}`);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
          <h3 className="text-sm font-medium text-surface-400 mb-4">Répartition par famille</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.byFamily}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                stroke="none"
                label={(props: PieLabelRenderProps) => `${props.name ?? ""} (${((props.percent ?? 0) * 100).toFixed(0)}%)`}
              >
                {data.byFamily.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
          <h3 className="text-sm font-medium text-surface-400 mb-4">Répartition par fournisseur</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.bySupplier}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                stroke="none"
                label={(props: PieLabelRenderProps) => `${props.name ?? ""} (${((props.percent ?? 0) * 100).toFixed(0)}%)`}
              >
                {data.bySupplier.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-surface-400">Prochaines fins de garantie</h3>
            <Link href="/installations?status=EN_PARC_GARANTIE" className="text-xs text-primary-400 hover:text-primary-300">
              Voir tout
            </Link>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {data.upcomingRenewals.length === 0 ? (
              <p className="text-sm text-surface-500 text-center py-8">Aucune échéance dans les 90 prochains jours</p>
            ) : (
              data.upcomingRenewals.map((r) => {
                const days = daysUntil(r.endDate);
                return (
                  <Link
                    key={r.id}
                    href={`/installations/${r.id}`}
                    className="flex items-center justify-between rounded-lg border border-surface-800 p-3 hover:bg-surface-800/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-surface-200 truncate">{r.product.name}</p>
                      <p className="text-xs text-surface-500">{r.client.name}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className={`flex items-center gap-1 text-xs font-bold ${getCountdownColor(r.endDate)}`}>
                        <Clock className="h-3 w-3" />
                        <span>{days}j</span>
                      </div>
                      <span className="text-xs text-surface-500">{formatDate(r.endDate)}</span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      {data.recentlyExpired.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-surface-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldX className="h-4 w-4 text-red-400" />
              <h3 className="text-sm font-medium text-red-400">En parc sans garantie</h3>
            </div>
            <Link href="/installations?status=EN_PARC_HORS_GARANTIE" className="text-xs text-primary-400 hover:text-primary-300">
              Voir tout
            </Link>
          </div>
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {data.recentlyExpired.map((r) => (
              <Link
                key={r.id}
                href={`/installations/${r.id}`}
                className="flex items-center justify-between rounded-lg border border-surface-800 p-2.5 hover:bg-surface-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-surface-200 truncate">{r.product.name}</p>
                  <p className="text-xs text-surface-500">{r.client.name}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="text-xs text-red-400 font-medium">{formatCountdown(r.endDate)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
