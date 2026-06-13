"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor, ShieldCheck, ShieldX, RefreshCw, Users, Package, Clock,
  AlertTriangle, Calendar, GripVertical, Plus, X, Settings2,
  TrendingUp, Activity, FileText, BarChart3, PieChart as PieChartIcon,
  DollarSign, Star, History, ClipboardList, Building2, User, MessageSquare, Paperclip,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { formatDate, daysUntil, formatCountdown, getCountdownColor, formatCurrency } from "@/lib/utils";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line, type PieLabelRenderProps,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

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
  topClients: { name: string; id: string; count: number }[];
  recentActivity: { id: string; type: string; description: string; date: string }[];
  financialSummary: { totalValue: number; avgDuration: number; renewalRate: number };
  statusBreakdown: { status: string; count: number }[];
  boardCards: {
    id: string;
    title: string;
    priority: number;
    assigneeId: string | null;
    dueDate: string | null;
    column: { id: string; name: string; color: string };
    client: { id: string; name: string } | null;
    contact: { id: string; firstName: string | null; lastName: string | null } | null;
    tags: { id: string; tag: { id: string; name: string; color: string } }[];
    _count: { comments: number; attachments: number };
    updatedAt: string;
  }[];
}

interface PanelConfig {
  id: string;
  type: string;
  size: "small" | "medium" | "large" | "full";
}

// ─── Available panels registry ───────────────────────────────────────────────

const PANEL_REGISTRY: Record<string, { label: string; icon: typeof Monitor; defaultSize: PanelConfig["size"]; description: string }> = {
  stats_main: { label: "Statistiques principales", icon: Monitor, defaultSize: "full", description: "Total installations, en parc, hors parc, renouvelés" },
  stats_expiring: { label: "Alertes d'expiration", icon: AlertTriangle, defaultSize: "full", description: "Compteurs 30/60/90 jours" },
  stats_entities: { label: "Clients & Produits", icon: Users, defaultSize: "full", description: "Nombre de clients et produits" },
  chart_monthly: { label: "Fins de garantie par mois", icon: BarChart3, defaultSize: "medium", description: "Graphique en barres des expirations mensuelles" },
  chart_family: { label: "Répartition par famille", icon: PieChartIcon, defaultSize: "medium", description: "Camembert par famille de produit" },
  chart_supplier: { label: "Répartition par fournisseur", icon: PieChartIcon, defaultSize: "medium", description: "Camembert par fournisseur" },
  list_renewals: { label: "Prochaines fins de garantie", icon: Clock, defaultSize: "medium", description: "Liste des garanties arrivant à échéance" },
  list_expired: { label: "Hors parc", icon: ShieldX, defaultSize: "full", description: "Installations récemment expirées" },
  top_clients: { label: "Top clients", icon: Star, defaultSize: "medium", description: "Clients avec le plus d'installations" },
  status_breakdown: { label: "Répartition par statut", icon: Activity, defaultSize: "medium", description: "Camembert des statuts d'installation" },
  chart_trend: { label: "Tendance expirations", icon: TrendingUp, defaultSize: "medium", description: "Courbe d'évolution des expirations" },
  financial_summary: { label: "Résumé financier", icon: DollarSign, defaultSize: "full", description: "Valeur totale, durée moyenne, taux de renouvellement" },
  recent_activity: { label: "Activité récente", icon: History, defaultSize: "medium", description: "Dernières synchronisations et modifications" },
  board_cards: { label: "Cartes du tableau", icon: ClipboardList, defaultSize: "full", description: "Dernières cartes du tableau de communication" },
  activity_feed: { label: "Fil d'activité", icon: Activity, defaultSize: "medium", description: "Flux global d'activité en temps réel" },
  emsisoft_security: { label: "Sécurité Emsisoft", icon: ShieldCheck, defaultSize: "medium", description: "Protection des appareils et menaces détectées" },
};

const DEFAULT_PANELS: PanelConfig[] = [
  { id: "p1", type: "stats_main", size: "full" },
  { id: "p2", type: "stats_expiring", size: "full" },
  { id: "p3", type: "stats_entities", size: "full" },
  { id: "p4", type: "chart_monthly", size: "medium" },
  { id: "p5", type: "chart_family", size: "medium" },
  { id: "p6", type: "chart_supplier", size: "medium" },
  { id: "p7", type: "list_renewals", size: "medium" },
  { id: "p8", type: "list_expired", size: "full" },
  { id: "p9", type: "board_cards", size: "full" },
  { id: "p10", type: "activity_feed", size: "medium" },
];

// ─── Chart helpers ───────────────────────────────────────────────────────────

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316"];
const STATUS_COLORS: Record<string, string> = {
  EN_PARC: "#10b981",
  HORS_PARC: "#ef4444",
  RENOUVELE: "#8b5cf6",
};
const STATUS_LABELS: Record<string, string> = {
  EN_PARC: "En parc",
  HORS_PARC: "Hors parc",
  RENOUVELE: "Renouvelé",
};

const RADIAN = Math.PI / 180;
function renderPieLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);
  const name = String(props.name ?? "");
  if (percent < 0.05) return null;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="var(--chart-label, #475569)" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={11}>
      {name.length > 12 ? name.slice(0, 12) + "…" : name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

function renderLegend(payload: readonly { color?: string; value?: string }[]) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", justifyContent: "center", paddingTop: 4 }}>
      {payload.map((entry, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--chart-label, #64748b)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, display: "inline-block" }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

function formatMonthFr(label: unknown) {
  if (typeof label !== "string") return String(label ?? "");
  const [year, m] = label.split("-");
  return `${m}/${year}`;
}

type FilterMode = "30" | "90" | "custom";

// ─── Panel Components ────────────────────────────────────────────────────────

function StatsMainPanel({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard title="Total installations" value={data.counts.total} icon={Monitor} color="blue" href="/installations" />
      <StatCard title="En parc" value={data.counts.enGarantie} icon={ShieldCheck} color="green" href="/installations?status=EN_PARC" />
      <StatCard title="Hors parc" value={data.counts.horsGarantie} icon={ShieldX} color="red" href="/installations?status=HORS_PARC" />
      <StatCard title="Renouvelés" value={data.counts.renouvele} icon={RefreshCw} color="blue" href="/installations?status=RENOUVELE" />
    </div>
  );
}

function StatsExpiringPanel({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Link href="/installations?expiring=30" className="rounded-xl border border-red-200 bg-red-50 p-4 hover:bg-red-100 transition-colors">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-600">Expire dans 30 jours</span>
        </div>
        <p className="text-2xl font-bold text-slate-900">{data.counts.expiring30}</p>
      </Link>
      <Link href="/installations?expiring=60" className="rounded-xl border border-orange-200 bg-orange-50 p-4 hover:bg-orange-100 transition-colors">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-600">Expire dans 60 jours</span>
        </div>
        <p className="text-2xl font-bold text-slate-900">{data.counts.expiring60}</p>
      </Link>
      <Link href="/installations?expiring=90" className="rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-600">Expire dans 90 jours</span>
        </div>
        <p className="text-2xl font-bold text-slate-900">{data.counts.expiring90}</p>
      </Link>
    </div>
  );
}

function StatsEntitiesPanel({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StatCard title="Clients" value={data.counts.totalClients} icon={Users} color="blue" href="/clients" />
      <StatCard title="Produits" value={data.counts.totalProducts} icon={Package} color="blue" href="/products" />
    </div>
  );
}

function ChartMonthlyPanel({ data }: { data: DashboardData }) {
  const router = useRouter();
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Fins de garantie par mois</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data.byMonth}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--tooltip-border, #e2e8f0)" />
          <XAxis dataKey="month" tickFormatter={formatMonthFr} tick={{ fill: "var(--chart-label, #64748b)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--chart-label, #64748b)", fontSize: 12 }} />
          <Tooltip contentStyle={{ backgroundColor: "var(--tooltip-bg, #ffffff)", border: "1px solid var(--tooltip-border, #e2e8f0)", borderRadius: "8px", color: "var(--tooltip-text, #334155)" }} labelFormatter={formatMonthFr} />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Fins de garantie" cursor="pointer"
            onClick={(_: unknown, index: number) => { const month = data.byMonth[index]?.month; if (month) router.push(`/installations?month=${month}`); }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartFamilyPanel({ data }: { data: DashboardData }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Répartition par famille</h3>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data.byFamily} cx="50%" cy="45%" innerRadius={55} outerRadius={90} dataKey="value" stroke="none" label={renderPieLabel}>
            {data.byFamily.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: "var(--tooltip-bg, #ffffff)", border: "1px solid var(--tooltip-border, #e2e8f0)", borderRadius: "8px", color: "var(--tooltip-text, #334155)" }} />
          <Legend content={({ payload }) => renderLegend(payload ?? [])} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartSupplierPanel({ data }: { data: DashboardData }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Répartition par fournisseur</h3>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={data.bySupplier} cx="50%" cy="45%" innerRadius={55} outerRadius={90} dataKey="value" stroke="none" label={renderPieLabel}>
            {data.bySupplier.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: "var(--tooltip-bg, #ffffff)", border: "1px solid var(--tooltip-border, #e2e8f0)", borderRadius: "8px", color: "var(--tooltip-text, #334155)" }} />
          <Legend content={({ payload }) => renderLegend(payload ?? [])} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ListRenewalsPanel({ data }: { data: DashboardData }) {
  const [filterMode, setFilterMode] = useState<FilterMode>("90");
  const [customDate, setCustomDate] = useState("");

  const filterDays = filterMode === "30" ? 30 : filterMode === "90" ? 90 : null;
  const filterEndDate = filterMode === "custom" && customDate ? new Date(customDate) : null;

  const filteredRenewals = data.upcomingRenewals.filter((r) => {
    const days = daysUntil(r.endDate);
    if (days < 0) return false;
    if (filterDays !== null) return days <= filterDays;
    if (filterEndDate) return new Date(r.endDate) <= filterEndDate;
    return true;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-500">Prochaines fins de garantie</h3>
        <Link href="/installations?status=EN_PARC" className="text-xs text-primary-600 hover:text-primary-700">Voir tout</Link>
      </div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(["30", "90"] as const).map((mode) => (
          <button key={mode} onClick={() => setFilterMode(mode)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterMode === mode ? "bg-primary-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            {mode} jours
          </button>
        ))}
        <button onClick={() => setFilterMode("custom")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1 ${filterMode === "custom" ? "bg-primary-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
          <Calendar className="h-3 w-3" /> Date
        </button>
        {filterMode === "custom" && (
          <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:border-primary-500 focus:outline-none" />
        )}
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {filteredRenewals.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Aucune échéance dans la période</p>
        ) : (
          filteredRenewals.map((r) => {
            const days = daysUntil(r.endDate);
            return (
              <Link key={r.id} href={`/installations/${r.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{r.product.name}</p>
                  <p className="text-xs text-slate-400">{r.client.name}</p>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <div className={`flex items-center gap-1 text-xs font-bold ${getCountdownColor(r.endDate)}`}>
                    <Clock className="h-3 w-3" /><span>{days}j</span>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(r.endDate)}</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}

function ListExpiredPanel({ data }: { data: DashboardData }) {
  if (data.recentlyExpired.length === 0) return null;
  return (
    <div className="rounded-xl border border-red-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldX className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-medium text-red-600">Hors parc</h3>
        </div>
        <Link href="/installations?status=HORS_PARC" className="text-xs text-primary-600 hover:text-primary-700">Voir tout</Link>
      </div>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {data.recentlyExpired.map((r) => (
          <Link key={r.id} href={`/installations/${r.id}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 truncate">{r.product.name}</p>
              <p className="text-xs text-slate-400">{r.client.name}</p>
            </div>
            <div className="text-right ml-3">
              <p className="text-xs text-red-600 font-medium">{formatCountdown(r.endDate)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function TopClientsPanel({ data }: { data: DashboardData }) {
  const topClients = data.topClients || [];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Top clients (par installations)</h3>
      {topClients.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Aucune donnée</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {topClients.map((c, i) => (
            <Link key={c.id} href={`/clients/${c.id}`}
              className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-colors">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-600">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
              </div>
              <span className="text-sm font-bold text-slate-600">{c.count}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBreakdownPanel({ data }: { data: DashboardData }) {
  const breakdown = data.statusBreakdown || [];
  if (breakdown.length === 0) return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Répartition par statut</h3>
      <p className="text-sm text-slate-400 text-center py-8">Aucune donnée</p>
    </div>
  );
  const chartData = breakdown.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    fill: STATUS_COLORS[s.status] || "#94a3b8",
  }));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Répartition par statut</h3>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="45%" innerRadius={55} outerRadius={90} dataKey="value" stroke="none" label={renderPieLabel}>
            {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: "var(--tooltip-bg, #ffffff)", border: "1px solid var(--tooltip-border, #e2e8f0)", borderRadius: "8px", color: "var(--tooltip-text, #334155)" }} />
          <Legend content={({ payload }) => renderLegend(payload ?? [])} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTrendPanel({ data }: { data: DashboardData }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Tendance des expirations</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data.byMonth}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--tooltip-border, #e2e8f0)" />
          <XAxis dataKey="month" tickFormatter={formatMonthFr} tick={{ fill: "var(--chart-label, #64748b)", fontSize: 12 }} />
          <YAxis tick={{ fill: "var(--chart-label, #64748b)", fontSize: 12 }} />
          <Tooltip contentStyle={{ backgroundColor: "var(--tooltip-bg, #ffffff)", border: "1px solid var(--tooltip-border, #e2e8f0)", borderRadius: "8px", color: "var(--tooltip-text, #334155)" }} labelFormatter={formatMonthFr} />
          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4, fill: "#3b82f6" }} name="Expirations" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function FinancialSummaryPanel({ data }: { data: DashboardData }) {
  const fin = data.financialSummary;
  if (!fin) return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Résumé financier</h3>
      <p className="text-sm text-slate-400 text-center py-4">Aucune donnée</p>
    </div>
  );
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Résumé financier</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
          <DollarSign className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-slate-900">{formatCurrency(fin.totalValue)}</p>
          <p className="text-xs text-slate-500">Valeur totale</p>
        </div>
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-center">
          <Clock className="h-5 w-5 text-blue-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-slate-900">{fin.avgDuration.toFixed(0)} mois</p>
          <p className="text-xs text-slate-500">Durée moyenne</p>
        </div>
        <div className="rounded-lg bg-purple-50 border border-purple-200 p-4 text-center">
          <RefreshCw className="h-5 w-5 text-purple-600 mx-auto mb-1" />
          <p className="text-xl font-bold text-slate-900">{fin.renewalRate.toFixed(1)}%</p>
          <p className="text-xs text-slate-500">Taux de renouvellement</p>
        </div>
      </div>
    </div>
  );
}

function RecentActivityPanel({ data }: { data: DashboardData }) {
  const activity = data.recentActivity || [];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-medium text-slate-500 mb-4">Activité récente</h3>
      {activity.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Aucune activité récente</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {activity.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
              <div className={`mt-0.5 rounded-full p-1.5 ${a.type === "sync" ? "bg-blue-50 text-blue-600" : a.type === "import" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                {a.type === "sync" ? <RefreshCw className="h-3 w-3" /> : a.type === "import" ? <FileText className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700">{a.description}</p>
                <p className="text-xs text-slate-400">{formatDate(a.date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardCardsPanel({ data }: { data: DashboardData }) {
  const cards = data.boardCards || [];
  const PRIORITY_CONFIG: Record<number, { label: string; color: string; dot: string }> = {
    1: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
    2: { label: "Normale", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
    3: { label: "Basse", color: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-medium text-slate-500">Cartes du tableau</h3>
        </div>
        <Link href="/board" className="text-xs text-primary-600 hover:text-primary-700">Voir le tableau</Link>
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Aucune carte</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((card) => {
            const p = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG[3];
            const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();
            const contactName = card.contact
              ? [card.contact.firstName, card.contact.lastName].filter(Boolean).join(" ")
              : null;
            return (
              <Link
                key={card.id}
                href={`/board?card=${card.id}`}
                className="rounded-lg border border-slate-200 p-3 hover:bg-slate-50 hover:border-slate-300 transition-colors block"
              >
                {/* Column + Priority */}
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: card.column.color }}
                  />
                  <span className="text-[10px] text-slate-400 truncate">{card.column.name}</span>
                  <span className={`ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${p.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                    {p.label}
                  </span>
                </div>

                {/* Title */}
                <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-1.5">{card.title}</p>

                {/* Client & Contact */}
                {(card.client || contactName) && (
                  <div className="flex flex-col gap-0.5 mb-1.5">
                    {card.client && (
                      <span className="flex items-center gap-1 text-xs text-slate-600">
                        <Building2 className="h-3 w-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{card.client.name}</span>
                      </span>
                    )}
                    {contactName && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{contactName}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Tags */}
                {card.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {card.tags.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className="px-1.5 py-0.5 text-[10px] font-medium rounded"
                        style={{ backgroundColor: t.tag.color + "20", color: t.tag.color }}
                      >
                        {t.tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    {card.dueDate && (
                      <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
                        <Calendar className="h-3 w-3" />
                        {new Date(card.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {card._count.comments > 0 && (
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {card._count.comments}
                      </span>
                    )}
                    {card._count.attachments > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Paperclip className="h-3 w-3" />
                        {card._count.attachments}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Activity Feed Panel ─────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  type: "activity" | "card" | "ticket_comment" | "card_comment";
  action: string;
  userName: string;
  entity: string;
  entityId: string;
  title: string;
  detail?: string;
  date: string;
}

function feedTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

const FEED_TYPE_CONFIG: Record<string, { icon: typeof Activity; color: string; bg: string }> = {
  activity: { icon: History, color: "text-blue-600", bg: "bg-blue-50" },
  card: { icon: ClipboardList, color: "text-purple-600", bg: "bg-purple-50" },
  ticket_comment: { icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-50" },
  card_comment: { icon: MessageSquare, color: "text-orange-600", bg: "bg-orange-50" },
};

const AVATAR_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1"];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ActivityFeedPanel() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(() => {
    fetch("/api/activity/feed?limit=20")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, [fetchFeed]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-medium text-slate-500">Fil d&apos;activité</h3>
        </div>
        <span className="text-xs text-slate-400">Voir tout</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <RefreshCw className="h-5 w-5 text-slate-300 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Aucune activité récente</p>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {items.map((item) => {
            const cfg = FEED_TYPE_CONFIG[item.type] || FEED_TYPE_CONFIG.activity;
            const IconComp = cfg.icon;
            const initial = (item.userName || "?").charAt(0).toUpperCase();
            const bgColor = avatarColor(item.userName);
            return (
              <div key={`${item.type}-${item.id}`} className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-slate-50 transition-colors">
                {/* Avatar */}
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: bgColor }}
                >
                  {initial}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug">
                    <span className="font-semibold text-slate-900">{item.userName}</span>{" "}
                    {item.title}
                  </p>
                  {item.detail && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{item.detail}</p>
                  )}
                </div>
                {/* Meta */}
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                  <div className={`rounded p-1 ${cfg.bg}`}>
                    <IconComp className={`h-3 w-3 ${cfg.color}`} />
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{feedTimeAgo(item.date)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Emsisoft Security Panel ────────────────────────────────────────────────

function EmisoftSecurityPanel() {
  const [data, setData] = useState<{
    totalDevices: number; totalFindings: number; workspaceCount: number;
    workspaces: { name: string; devices: number; findingsLastMonth: number; isExpired: boolean; isExpiresSoon: boolean; totalSeat: number; usedSeat: number }[];
    recentAlerts: { workspaceName: string; findingType: string; detectedAt: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);

  const fetchData = useCallback(() => {
    fetch("/api/emsisoft")
      .then((r) => r.json())
      .then((d) => { if (!d.enabled) { setEnabled(false); } else { setData(d); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 120_000); return () => clearInterval(i); }, [fetchData]);

  if (!enabled) return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400 text-center">Emsisoft non configuré</div>;
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-6 flex justify-center"><RefreshCw className="h-5 w-5 text-slate-300 animate-spin" /></div>;
  if (!data) return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-red-400">Erreur de connexion</div>;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="h-4 w-4 text-purple-600" />
        <h3 className="text-sm font-medium text-slate-500">Sécurité Emsisoft</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center"><p className="text-2xl font-bold text-blue-600">{data.workspaceCount}</p><p className="text-xs text-slate-400">Workspaces</p></div>
        <div className="text-center"><p className="text-2xl font-bold text-emerald-600">{data.totalDevices}</p><p className="text-xs text-slate-400">Appareils</p></div>
        <div className="text-center"><p className={`text-2xl font-bold ${data.totalFindings > 0 ? "text-amber-600" : "text-slate-400"}`}>{data.totalFindings}</p><p className="text-xs text-slate-400">Détections/mois</p></div>
      </div>
      {data.workspaces.filter(w => w.isExpired || w.isExpiresSoon).length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-1 mb-3">
          {data.workspaces.filter(w => w.isExpired || w.isExpiresSoon).map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <ShieldX className="h-3 w-3 text-red-500 shrink-0" />
              <span className="text-slate-700 truncate flex-1">{w.name}</span>
              <span className={w.isExpired ? "text-red-500 font-medium" : "text-amber-500"}>{w.isExpired ? "Expiré" : "Expire bientôt"}</span>
            </div>
          ))}
        </div>
      )}
      {data.recentAlerts.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-1">
          <p className="text-xs font-medium text-slate-500 mb-1">Alertes récentes</p>
          {data.recentAlerts.slice(0, 5).map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <ShieldX className="h-3 w-3 text-red-500 shrink-0" />
              <span className="text-slate-700 truncate flex-1">{a.findingType}</span>
              <span className="text-slate-400 shrink-0">{a.workspaceName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel renderer ──────────────────────────────────────────────────────────

function renderPanel(panel: PanelConfig, data: DashboardData) {
  switch (panel.type) {
    case "stats_main": return <StatsMainPanel data={data} />;
    case "stats_expiring": return <StatsExpiringPanel data={data} />;
    case "stats_entities": return <StatsEntitiesPanel data={data} />;
    case "chart_monthly": return <ChartMonthlyPanel data={data} />;
    case "chart_family": return <ChartFamilyPanel data={data} />;
    case "chart_supplier": return <ChartSupplierPanel data={data} />;
    case "list_renewals": return <ListRenewalsPanel data={data} />;
    case "list_expired": return <ListExpiredPanel data={data} />;
    case "top_clients": return <TopClientsPanel data={data} />;
    case "status_breakdown": return <StatusBreakdownPanel data={data} />;
    case "chart_trend": return <ChartTrendPanel data={data} />;
    case "financial_summary": return <FinancialSummaryPanel data={data} />;
    case "recent_activity": return <RecentActivityPanel data={data} />;
    case "board_cards": return <BoardCardsPanel data={data} />;
    case "activity_feed": return <ActivityFeedPanel />;
    case "emsisoft_security": return <EmisoftSecurityPanel />;
    default: return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">Panneau inconnu</div>;
  }
}

// ─── Add Panel Modal ─────────────────────────────────────────────────────────

function AddPanelModal({ currentPanels, onAdd, onClose }: {
  currentPanels: PanelConfig[];
  onAdd: (type: string) => void;
  onClose: () => void;
}) {
  const usedTypes = new Set(currentPanels.map((p) => p.type));
  const available = Object.entries(PANEL_REGISTRY).filter(([type]) => !usedTypes.has(type));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Ajouter un panneau</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-96 overflow-y-auto p-4 space-y-2">
          {available.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Tous les panneaux sont déjà affichés</p>
          ) : (
            available.map(([type, info]) => (
              <button key={type} onClick={() => { onAdd(type); onClose(); }}
                className="flex w-full items-center gap-4 rounded-lg border border-slate-200 p-4 text-left hover:bg-slate-50 transition-colors">
                <div className="rounded-lg bg-primary-50 p-2.5">
                  <info.icon className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">{info.label}</p>
                  <p className="text-xs text-slate-400">{info.description}</p>
                </div>
                <Plus className="h-4 w-4 text-slate-400" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panels, setPanels] = useState<PanelConfig[]>(DEFAULT_PANELS);
  const [editMode, setEditMode] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [cometExploding, setCometExploding] = useState(false);
  const [showCedelia, setShowCedelia] = useState(false);
  const [siteLogo, setSiteLogo] = useState<string>("");
  const layoutLoaded = useRef(false);

  const triggerCometExplosion = useCallback(() => {
    if (cometExploding) return;
    setCometExploding(true);
    setTimeout(() => {
      setCometExploding(false);
      setShowCedelia(true);
    }, 2000);
  }, [cometExploding]);

  // Load branding logo
  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((d) => { if (d.site_logo) setSiteLogo(d.site_logo); })
      .catch(() => {});
  }, []);

  // Load saved layout
  useEffect(() => {
    fetch("/api/dashboard/layout")
      .then((r) => r.json())
      .then((d) => {
        if (d.layout && Array.isArray(d.layout) && d.layout.length > 0) {
          setPanels(d.layout);
        }
        layoutLoaded.current = true;
      })
      .catch(() => { layoutLoaded.current = true; });
  }, []);

  // Load dashboard data
  const refreshData = useCallback(() => {
    fetch("/api/dashboard/stats")
      .then((r) => { if (!r.ok) throw new Error(`Erreur ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Refresh data when returning to the page (e.g. after editing an installation)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshData();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refreshData);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refreshData);
    };
  }, [refreshData]);

  // Save layout
  const saveLayout = useCallback((newPanels: PanelConfig[]) => {
    setPanels(newPanels);
    if (layoutLoaded.current) {
      fetch("/api/dashboard/layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panels: newPanels }),
      }).catch(() => {});
    }
  }, []);

  function addPanel(type: string) {
    const info = PANEL_REGISTRY[type];
    if (!info) return;
    const newPanel: PanelConfig = { id: `p_${Date.now()}`, type, size: info.defaultSize };
    saveLayout([...panels, newPanel]);
  }

  function removePanel(id: string) {
    saveLayout(panels.filter((p) => p.id !== id));
  }

  function changePanelSize(id: string) {
    const sizes: PanelConfig["size"][] = ["small", "medium", "large", "full"];
    saveLayout(panels.map((p) => {
      if (p.id !== id) return p;
      const idx = sizes.indexOf(p.size);
      return { ...p, size: sizes[(idx + 1) % sizes.length] };
    }));
  }

  // Drag and drop
  function handleDragStart(idx: number) {
    setDraggedIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(idx: number) {
    if (draggedIdx === null || draggedIdx === idx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newPanels = [...panels];
    const [moved] = newPanels.splice(draggedIdx, 1);
    newPanels.splice(idx, 0, moved);
    saveLayout(newPanels);
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  function handleDragEnd() {
    setDraggedIdx(null);
    setDragOverIdx(null);
  }

  function resetLayout() {
    saveLayout([...DEFAULT_PANELS]);
  }

  if (loading) return <LoadingSpinner />;

  if (error || !data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-600 font-medium mb-2">Erreur de chargement</p>
          <p className="text-sm text-slate-500">{error || "Données indisponibles"}</p>
          <button onClick={() => { setError(null); setLoading(true); fetch("/api/dashboard/stats").then(r => { if (!r.ok) throw new Error(`Erreur ${r.status}`); return r.json(); }).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); }}
            className="mt-3 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-500 transition">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const sizeClasses: Record<PanelConfig["size"], string> = {
    small: "col-span-1",
    medium: "col-span-1 lg:col-span-1",
    large: "col-span-1 lg:col-span-2",
    full: "col-span-1 lg:col-span-2",
  };

  return (
    <div className="space-y-6">
      {/* Comet explosion overlay */}
      {cometExploding && (
        <div className="comet-explosion-overlay" aria-hidden="true">
          <div className="comet-meteor" />
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="comet-particle"
              style={{
                '--angle': `${Math.random() * 360}deg`,
                '--distance': `${80 + Math.random() * 300}px`,
                '--size': `${3 + Math.random() * 8}px`,
                '--delay': `${Math.random() * 0.15}s`,
                '--hue': `${190 + Math.random() * 40}`,
              } as React.CSSProperties}
            />
          ))}
          <div className="comet-shockwave" />
          <div className="comet-flash" />
        </div>
      )}

      <style jsx>{`
        .comet-explosion-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          overflow: hidden;
        }

        .comet-meteor {
          position: absolute;
          top: -60px;
          right: -60px;
          width: 30px;
          height: 30px;
          background: radial-gradient(circle, #fff 0%, #7dd3fc 40%, #0ea5e9 70%, transparent 100%);
          border-radius: 50%;
          box-shadow: 0 0 40px 15px rgba(14, 165, 233, 0.8), 0 0 80px 30px rgba(14, 165, 233, 0.4);
          animation: meteorFly 0.5s ease-in forwards;
        }

        .comet-meteor::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 200px;
          height: 4px;
          background: linear-gradient(to right, rgba(125, 211, 252, 0.8), transparent);
          transform-origin: left center;
          transform: rotate(45deg);
        }

        @keyframes meteorFly {
          0% { top: -60px; right: -60px; opacity: 1; }
          100% { top: 50%; right: 50%; transform: translate(50%, -50%); opacity: 1; }
        }

        .comet-shockwave {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          border: 3px solid rgba(14, 165, 233, 0.6);
          transform: translate(-50%, -50%);
          animation: shockwaveExpand 0.8s ease-out 0.45s forwards;
        }

        @keyframes shockwaveExpand {
          0% { width: 0; height: 0; opacity: 1; border-width: 4px; }
          100% { width: 200vmax; height: 200vmax; opacity: 0; border-width: 1px; }
        }

        .comet-flash {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(125,211,252,0.6) 30%, rgba(14,165,233,0.2) 60%, transparent 70%);
          transform: translate(-50%, -50%);
          animation: flashBang 0.7s ease-out 0.4s forwards;
        }

        @keyframes flashBang {
          0% { width: 0; height: 0; opacity: 1; }
          30% { width: 120vmax; height: 120vmax; opacity: 0.9; }
          100% { width: 150vmax; height: 150vmax; opacity: 0; }
        }

        .comet-particle {
          position: absolute;
          top: 50%;
          left: 50%;
          width: var(--size);
          height: var(--size);
          background: hsl(var(--hue), 90%, 70%);
          border-radius: 50%;
          box-shadow: 0 0 6px hsl(var(--hue), 90%, 60%);
          animation: particleExplode 1.2s ease-out calc(0.45s + var(--delay)) forwards;
          opacity: 0;
        }

        @keyframes particleExplode {
          0% { transform: translate(-50%, -50%) translate(0, 0); opacity: 1; }
          20% { opacity: 1; }
          100% {
            transform: translate(-50%, -50%)
              translate(
                calc(cos(var(--angle)) * var(--distance)),
                calc(sin(var(--angle)) * var(--distance))
              );
            opacity: 0;
          }
        }
      `}</style>

      {/* Cedelia.fr overlay */}
      {showCedelia && (
        <div className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowCedelia(false)}>
          <div className="relative w-full max-w-5xl h-[80vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <button onClick={() => setShowCedelia(false)} className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs text-slate-400 ml-2 font-mono">cedelia.fr</span>
              </div>
              <a
                href="https://cedelia.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Ouvrir dans un nouvel onglet ↗
              </a>
            </div>
            <iframe
              src="https://cedelia.fr"
              className="w-full h-full border-0"
              title="Cedelia.fr"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={triggerCometExplosion}
              className="relative group cursor-pointer transition-transform hover:scale-110 active:scale-95"
              title="Comète !"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={siteLogo || "/logo.png"}
                alt="COMET Logo"
                className="h-10 w-10 rounded-lg object-contain drop-shadow-md"
              />
            </button>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">Suivi des garanties et échéances</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode && (
            <>
              <button onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-xs font-medium text-white hover:bg-primary-700 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Ajouter
              </button>
              <button onClick={resetLayout}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors">
                <RefreshCw className="h-3.5 w-3.5" /> Réinitialiser
              </button>
            </>
          )}
          <button onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              editMode ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-300 text-slate-500 hover:bg-slate-50"
            }`}>
            <Settings2 className="h-3.5 w-3.5" />
            {editMode ? "Terminer" : "Personnaliser"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {panels.map((panel, idx) => {
          const info = PANEL_REGISTRY[panel.type];
          const sizeLabel = panel.size === "full" ? "Pleine" : panel.size === "large" ? "Grande" : panel.size === "medium" ? "Moyenne" : "Petite";
          return (
            <div
              key={panel.id}
              className={`${sizeClasses[panel.size]} ${
                editMode ? "relative group" : ""
              } ${dragOverIdx === idx ? "ring-2 ring-primary-400 ring-offset-2 rounded-xl" : ""} ${
                draggedIdx === idx ? "opacity-50" : ""
              } transition-all`}
              draggable={editMode}
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
            >
              {editMode && (
                <div className="absolute -top-2 left-0 right-0 z-10 flex items-center justify-between px-2">
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-2.5 py-1 text-white shadow-lg backdrop-blur-sm cursor-grab active:cursor-grabbing">
                    <GripVertical className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{info?.label || panel.type}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => changePanelSize(panel.id)}
                      className="rounded-md bg-slate-900/90 px-2 py-1 text-[10px] font-medium text-white shadow-lg backdrop-blur-sm hover:bg-slate-800 transition-colors"
                      title="Changer la taille">
                      {sizeLabel}
                    </button>
                    <button onClick={() => removePanel(panel.id)}
                      className="rounded-md bg-red-600/90 p-1 text-white shadow-lg backdrop-blur-sm hover:bg-red-500 transition-colors"
                      title="Supprimer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <div className={editMode ? "mt-4" : ""}>
                {renderPanel(panel, data)}
              </div>
            </div>
          );
        })}
      </div>

      {panels.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-300 p-12 text-center">
          <Settings2 className="h-8 w-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-3">Aucun panneau affiché</p>
          <button onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
            Ajouter un panneau
          </button>
        </div>
      )}

      {showAddModal && (
        <AddPanelModal currentPanels={panels} onAdd={addPanel} onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
