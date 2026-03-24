"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Ticket, Clock, Users, FileText, AlertCircle,
  User, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  type PieLabelRenderProps,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ReportData {
  summary: {
    totalTickets: number;
    totalHours: number;
    openTickets: number;
    resolvedTickets: number;
    totalHoursIncluded: number;
    totalOverage: number;
    customerCount: number;
    contractCount: number;
  };
  byStatus: { status: string; count: number }[];
  byMonth: { month: string; tickets: number; hours: number }[];
  byTechnician: { name: string; hours: number; tickets: number }[];
  byCustomer: {
    customerId: number;
    customerName: string;
    cometClientId: string | null;
    ticketCount: number;
    openTickets: number;
    pendingTickets: number;
    resolvedTickets: number;
    totalHoursUsed: number;
    totalHoursIncluded: number;
    hoursRemaining: number;
    overage: number;
    contractCount: number;
  }[];
  recentTickets: {
    ticketId: number;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    customerName: string;
    technician: string;
    createdDate: string;
    resolvedDate: string | null;
    workHours: number;
  }[];
}

// ─── Chart helpers ───────────────────────────────────────────────────────────

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#6366f1"];

const STATUS_COLORS: Record<string, string> = {
  Open: "#ef4444",
  Pending: "#f59e0b",
  Resolved: "#10b981",
  Closed: "#6366f1",
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
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

function formatHours(h: number) {
  return h.toFixed(1).replace(/\.0$/, "") + "h";
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AteraReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [expandedCustomers, setExpandedCustomers] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = customerFilter ? `?customer=${encodeURIComponent(customerFilter)}` : "";
      const res = await fetch(`/api/atera/report${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [customerFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchData, customerFilter ? 500 : 0);
    return () => clearTimeout(timer);
  }, [fetchData, customerFilter]);

  const toggleCustomer = (id: number) => {
    setExpandedCustomers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={fetchData} className="text-sm text-primary-600 hover:underline">Réessayer</button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, byStatus, byMonth, byTechnician, byCustomer, recentTickets } = data;

  const statusData = byStatus.map(s => ({
    ...s,
    fill: STATUS_COLORS[s.status] || "#94a3b8",
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rapport Atera</h1>
          <p className="text-sm text-slate-500">Vue d&apos;ensemble des tickets, contrats et heures</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filtrer par client..."
            value={customerFilter}
            onChange={e => setCustomerFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 w-56"
          />
          <button
            onClick={fetchData}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Actualiser
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Total tickets" value={summary.totalTickets} icon={Ticket} color="blue" />
        <StatCard title="Tickets ouverts" value={summary.openTickets} icon={AlertCircle} color="red" />
        <StatCard title="Heures totales" value={formatHours(summary.totalHours)} icon={Clock} color="amber" />
        <StatCard title="Clients" value={summary.customerCount} icon={Users} color="green" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Tickets résolus" value={summary.resolvedTickets} icon={Ticket} color="green" />
        <StatCard title="Contrats" value={summary.contractCount} icon={FileText} color="blue" />
        <StatCard
          title="Heures incluses"
          value={formatHours(summary.totalHoursIncluded)}
          icon={Clock}
          color="green"
        />
        <StatCard
          title="Dépassement"
          value={formatHours(summary.totalOverage)}
          icon={Clock}
          color={summary.totalOverage > 0 ? "red" : "green"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tickets by month */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Tickets par mois</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid, #e2e8f0)" />
              <XAxis dataKey="month" tickFormatter={formatMonthFr} fontSize={11} tick={{ fill: "var(--chart-label, #64748b)" }} />
              <YAxis fontSize={11} tick={{ fill: "var(--chart-label, #64748b)" }} />
              <Tooltip
                formatter={(v, name) => [name === "hours" ? formatHours(v as number) : v, name === "hours" ? "Heures" : "Tickets"]}
                labelFormatter={formatMonthFr}
                contentStyle={{ background: "var(--tooltip-bg, #fff)", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="tickets" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Tickets" />
              <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Heures" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tickets by status */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Répartition par statut</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={renderPieLabel}
              >
                {statusData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => [v, "Tickets"]}
                contentStyle={{ background: "var(--tooltip-bg, #fff)", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
              />
              <Legend content={({ payload }) => renderLegend(payload || [])} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Technicians & Recent Tickets row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* By technician */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <User className="h-4 w-4" />
            Heures par technicien
          </h2>
          <div className="space-y-3">
            {byTechnician.slice(0, 10).map((tech, i) => {
              const maxHours = byTechnician[0]?.hours || 1;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium truncate max-w-[60%]">{tech.name}</span>
                    <span className="text-slate-500">{formatHours(tech.hours)} ({tech.tickets} tickets)</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary-500 transition-all"
                      style={{ width: `${(tech.hours / maxHours) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {byTechnician.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Aucune donnée</p>
            )}
          </div>
        </div>

        {/* Recent tickets */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Derniers tickets
          </h2>
          <div className="space-y-2 max-h-[340px] overflow-y-auto">
            {recentTickets.map(ticket => (
              <div key={ticket.ticketId} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      ticket.status === "Open" ? "bg-red-100 text-red-700" :
                      ticket.status === "Pending" ? "bg-amber-100 text-amber-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {ticket.status}
                    </span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || "bg-slate-100 text-slate-600"}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate">{ticket.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {ticket.customerName} &middot; {ticket.technician} &middot; {formatHours(ticket.workHours)}
                  </p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  {new Date(ticket.createdDate).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}
            {recentTickets.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Aucun ticket récent</p>
            )}
          </div>
        </div>
      </div>

      {/* By Customer */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Détail par client
        </h2>
        <div className="space-y-2">
          {byCustomer.map(customer => {
            const isExpanded = expandedCustomers.has(customer.customerId);
            const hoursPercent = customer.totalHoursIncluded > 0
              ? Math.min(100, (customer.totalHoursUsed / customer.totalHoursIncluded) * 100)
              : 0;
            const isOverage = customer.overage > 0;

            return (
              <div key={customer.customerId} className="rounded-lg border border-slate-100">
                <button
                  onClick={() => toggleCustomer(customer.customerId)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{customer.customerName}</span>
                      {isOverage && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Dépassement
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span>{customer.ticketCount} tickets</span>
                      <span>{formatHours(customer.totalHoursUsed)} utilisées</span>
                      {customer.totalHoursIncluded > 0 && (
                        <span>/ {formatHours(customer.totalHoursIncluded)} incluses</span>
                      )}
                      <span>{customer.contractCount} contrat{customer.contractCount > 1 ? "s" : ""}</span>
                    </div>
                    {customer.totalHoursIncluded > 0 && (
                      <div className="mt-2 h-1.5 rounded-full bg-slate-100 w-full max-w-xs">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isOverage ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, hoursPercent)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
                      <div>
                        <p className="text-xs text-slate-500">Ouverts</p>
                        <p className="text-lg font-bold text-red-600">{customer.openTickets}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">En attente</p>
                        <p className="text-lg font-bold text-amber-600">{customer.pendingTickets}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Résolus</p>
                        <p className="text-lg font-bold text-emerald-600">{customer.resolvedTickets}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Restant</p>
                        <p className={`text-lg font-bold ${isOverage ? "text-red-600" : "text-emerald-600"}`}>
                          {isOverage ? `-${formatHours(customer.overage)}` : formatHours(customer.hoursRemaining)}
                        </p>
                      </div>
                    </div>
                    {customer.cometClientId && (
                      <div className="mt-3 text-center">
                        <a
                          href={`/clients/${customer.cometClientId}`}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Voir la fiche client COMET
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {byCustomer.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Aucun client trouvé</p>
          )}
        </div>
      </div>
    </div>
  );
}
