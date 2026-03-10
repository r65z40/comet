"use client";

import { useEffect, useState } from "react";
import { Monitor, CheckCircle, AlertTriangle, XCircle, Users, Package, Clock } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, daysUntil } from "@/lib/utils";
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
    active: number;
    soonExpiring: number;
    expired: number;
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
    client: { id: string; name: string };
    product: { id: string; name: string };
  }[];
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-surface-400 mt-1">Vue d&apos;ensemble des installations et échéances</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total installations" value={data.counts.total} icon={Monitor} color="blue" />
        <StatCard title="Actives" value={data.counts.active} icon={CheckCircle} color="green" />
        <StatCard
          title="Bientôt expirées"
          value={data.counts.soonExpiring}
          icon={AlertTriangle}
          color="amber"
          trend={`${data.counts.expiring30} dans 30j`}
        />
        <StatCard title="Expirées" value={data.counts.expired} icon={XCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard title="Clients" value={data.counts.totalClients} icon={Users} color="blue" />
        <StatCard title="Produits" value={data.counts.totalProducts} icon={Package} color="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-surface-800 bg-surface-900 p-6">
          <h3 className="text-sm font-medium text-surface-400 mb-4">Échéances par mois</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  color: "#e2e8f0",
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Échéances" />
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
            <h3 className="text-sm font-medium text-surface-400">À renouveler</h3>
            <Link href="/installations?status=BIENTOT_EXPIRE" className="text-xs text-primary-400 hover:text-primary-300">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {data.upcomingRenewals.length === 0 ? (
              <p className="text-sm text-surface-500 text-center py-8">Aucune échéance proche</p>
            ) : (
              data.upcomingRenewals.map((r) => (
                <Link
                  key={r.id}
                  href={`/installations/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-surface-800 p-3 hover:bg-surface-800/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-surface-200 truncate">{r.product.name}</p>
                    <p className="text-xs text-surface-500">{r.client.name}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <div className="flex items-center gap-1 text-xs text-surface-400">
                      <Clock className="h-3 w-3" />
                      <span>{daysUntil(r.endDate)}j</span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
