"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Users,
  ShoppingCart,
  AlertCircle,
  Package,
  Monitor,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PieChart,
  Search,
  X,
  ChevronDown,
  Download,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
  Line,
} from "recharts";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface KPIs {
  totalRevenue: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
  invoiceCount: number;
  averageInvoice: number;
  totalPaid: number;
  totalUnpaid: number;
  unpaidCount: number;
  activeInstallations: number;
  renewalInstallations: number;
}

interface MonthlyData {
  month: string;
  label: string;
  revenue: number;
  cost: number;
  margin: number;
  count: number;
}

interface FamilyData {
  name: string;
  revenue: number;
  cost: number;
  count: number;
}

interface TopClient {
  id: string;
  name: string;
  revenue: number;
  invoiceCount: number;
}

interface TopProduct {
  id: string;
  name: string;
  revenue: number;
  quantity: number;
  cost: number;
  margin: number;
}

interface UnpaidInvoice {
  id: string;
  invoiceNumber: string | null;
  clientName: string;
  clientId: string;
  date: string;
  amount: number;
  status: string | null;
}

interface FinancialData {
  kpis: KPIs;
  monthlyData: MonthlyData[];
  familyData: FamilyData[];
  topClients: TopClient[];
  topProducts: TopProduct[];
  unpaidDetail: UnpaidInvoice[];
  filters: { families: string[]; suppliers: string[] };
}

type Period = "month" | "quarter" | "year" | "last-month" | "last-quarter" | "last-year" | "custom";

function getPeriodDates(period: Period): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case "month":
      return { from: `${y}-${String(m + 1).padStart(2, "0")}-01`, to: now.toISOString().slice(0, 10) };
    case "last-month": {
      const lm = m === 0 ? 11 : m - 1;
      const ly = m === 0 ? y - 1 : y;
      const lastDay = new Date(ly, lm + 1, 0).getDate();
      return { from: `${ly}-${String(lm + 1).padStart(2, "0")}-01`, to: `${ly}-${String(lm + 1).padStart(2, "0")}-${lastDay}` };
    }
    case "quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return { from: `${y}-${String(qStart + 1).padStart(2, "0")}-01`, to: now.toISOString().slice(0, 10) };
    }
    case "last-quarter": {
      const cqStart = Math.floor(m / 3) * 3;
      const lqStart = cqStart - 3;
      const lqY = lqStart < 0 ? y - 1 : y;
      const lqM = lqStart < 0 ? lqStart + 12 : lqStart;
      const lqEnd = new Date(lqY, lqM + 3, 0);
      return { from: `${lqY}-${String(lqM + 1).padStart(2, "0")}-01`, to: lqEnd.toISOString().slice(0, 10) };
    }
    case "year":
      return { from: `${y}-01-01`, to: now.toISOString().slice(0, 10) };
    case "last-year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return { from: `${y}-01-01`, to: now.toISOString().slice(0, 10) };
  }
}

const PERIOD_LABELS: Record<Period, string> = {
  "month": "Ce mois",
  "last-month": "Mois dernier",
  "quarter": "Ce trimestre",
  "last-quarter": "Trimestre dernier",
  "year": "Cette année",
  "last-year": "Année dernière",
  "custom": "Personnalisé",
};

const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1"];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function formatNumber(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n);
}

function tooltipFmt(v: unknown) {
  return formatCurrency(Number(v ?? 0));
}

export default function ChiffresPage() {
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("year");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<{ id: string; name: string }[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [family, setFamily] = useState("");
  const [supplier, setSupplier] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "unpaid" | "margins">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const dates = period === "custom" ? { from: customFrom, to: customTo } : getPeriodDates(period);
    if (!dates.from || !dates.to) { setLoading(false); return; }
    const params = new URLSearchParams({ from: dates.from, to: dates.to });
    if (clientId) params.set("clientId", clientId);
    if (family) params.set("family", family);
    if (supplier) params.set("supplier", supplier);
    try {
      const res = await fetch(`/api/financials?${params}`);
      if (res.ok) setData(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, [period, customFrom, customTo, clientId, family, supplier]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (clientSearch.length >= 2) {
      const t = setTimeout(async () => {
        try {
          const res = await fetch(`/api/clients?search=${encodeURIComponent(clientSearch)}&limit=8`);
          if (res.ok) {
            const d = await res.json();
            setClientResults(d.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
            setShowClientDropdown(true);
          }
        } catch {}
      }, 300);
      return () => clearTimeout(t);
    } else {
      setClientResults([]);
      setShowClientDropdown(false);
    }
  }, [clientSearch]);

  const kpis = data?.kpis;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chiffres</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vue financière de votre activité</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Period */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Période</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Custom dates */}
          {period === "custom" && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Du</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Au</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
            </>
          )}

          {/* Client search */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1">Client</label>
            <div className="relative">
              <input
                type="text"
                value={selectedClientName || clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setSelectedClientName(""); setClientId(""); }}
                placeholder="Tous les clients"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-48 focus:ring-2 focus:ring-primary-500 outline-none"
              />
              {clientId && (
                <button onClick={() => { setClientId(""); setClientSearch(""); setSelectedClientName(""); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {showClientDropdown && clientResults.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {clientResults.map((c) => (
                  <button key={c.id} onClick={() => { setClientId(c.id); setSelectedClientName(c.name); setClientSearch(""); setShowClientDropdown(false); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{c.name}</button>
                ))}
              </div>
            )}
          </div>

          {/* Family */}
          {data?.filters.families && data.filters.families.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Famille</label>
              <select value={family} onChange={(e) => setFamily(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="">Toutes</option>
                {data.filters.families.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {/* Supplier */}
          {data?.filters.suppliers && data.filters.suppliers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fournisseur</label>
              <select value={supplier} onChange={(e) => setSupplier(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="">Tous</option>
                {data.filters.suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-500">Erreur de chargement</div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {([
              { key: "overview", label: "Vue d'ensemble" },
              { key: "unpaid", label: `Impayés (${kpis?.unpaidCount ?? 0})` },
              { key: "margins", label: "Marges & Produits" },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  activeTab === tab.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && kpis && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Chiffre d'affaires" value={formatCurrency(kpis.totalRevenue)} color="blue" />
                <KpiCard icon={<FileText className="h-5 w-5" />} label="Factures" value={formatNumber(kpis.invoiceCount)} sub={`Moy. ${formatCurrency(kpis.averageInvoice)}`} color="slate" />
                <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Encaissé" value={formatCurrency(kpis.totalPaid)} color="emerald" />
                <KpiCard icon={<AlertCircle className="h-5 w-5" />} label="Impayés" value={formatCurrency(kpis.totalUnpaid)} sub={`${kpis.unpaidCount} facture${kpis.unpaidCount > 1 ? "s" : ""}`} color="red" />
                <KpiCard icon={<Monitor className="h-5 w-5" />} label="Installations actives" value={formatNumber(kpis.activeInstallations)} color="purple" />
                <KpiCard icon={<RotateCcw className="h-5 w-5" />} label="À renouveler (90j)" value={formatNumber(kpis.renewalInstallations)} color="amber" />
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue chart */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Chiffre d&apos;affaires par mois</h3>
                  {data.monthlyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={data.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                        <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                        <Tooltip formatter={tooltipFmt} labelStyle={{ fontWeight: 600 }} />
                        <Bar dataKey="revenue" name="CA" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Line dataKey="margin" name="Marge" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">Aucune donnée</div>
                  )}
                </div>

                {/* Family pie chart */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Répartition par famille</h3>
                  {data.familyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPie>
                        <Pie
                          data={data.familyData.slice(0, 8)}
                          dataKey="revenue"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          innerRadius={50}
                          paddingAngle={2}
                          label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {data.familyData.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={tooltipFmt} />
                      </RechartsPie>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">Aucune donnée</div>
                  )}
                </div>
              </div>

              {/* Top clients table */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Top 10 clients</h3>
                {data.topClients.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">CA</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Factures</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">% du total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topClients.map((c, i) => (
                          <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400 font-medium">{i + 1}</td>
                            <td className="py-2.5 px-3">
                              <Link href={`/clients/${c.id}`} className="text-primary-600 hover:text-primary-700 font-medium hover:underline">
                                {c.name}
                              </Link>
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatCurrency(c.revenue)}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{c.invoiceCount}</td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-primary-500 rounded-full" style={{ width: `${kpis.totalRevenue > 0 ? (c.revenue / kpis.totalRevenue * 100) : 0}%` }} />
                                </div>
                                <span className="text-slate-500 text-xs w-10 text-right">
                                  {kpis.totalRevenue > 0 ? (c.revenue / kpis.totalRevenue * 100).toFixed(1) : 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm text-center py-6">Aucune donnée</p>
                )}
              </div>
            </>
          )}

          {activeTab === "unpaid" && kpis && (
            <>
              {/* Unpaid KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard icon={<AlertCircle className="h-5 w-5" />} label="Total impayé" value={formatCurrency(kpis.totalUnpaid)} color="red" />
                <KpiCard icon={<FileText className="h-5 w-5" />} label="Factures impayées" value={formatNumber(kpis.unpaidCount)} color="orange" />
                <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Taux d'encaissement" value={`${kpis.totalRevenue > 0 ? ((kpis.totalPaid / kpis.totalRevenue) * 100).toFixed(1) : 0}%`} color="emerald" />
              </div>

              {/* Paid vs Unpaid bar chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Encaissé vs Impayé par mois</h3>
                {data.monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={tooltipFmt} />
                      <Bar dataKey="revenue" name="CA total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">Aucune donnée</div>
                )}
              </div>

              {/* Unpaid invoices table */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Factures impayées</h3>
                {data.unpaidDetail.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">N° Facture</th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Montant</th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Statut</th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Retard</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.unpaidDetail.map((inv) => {
                          const daysSince = Math.floor((Date.now() - new Date(inv.date).getTime()) / 86400000);
                          const isLate = daysSince > 30;
                          const isVeryLate = daysSince > 60;
                          return (
                            <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3">
                                <Link href={`/invoices/${inv.id}`} className="text-primary-600 hover:underline font-medium">
                                  {inv.invoiceNumber || inv.id.slice(0, 8)}
                                </Link>
                              </td>
                              <td className="py-2.5 px-3">
                                <Link href={`/clients/${inv.clientId}`} className="text-slate-700 hover:text-primary-600">
                                  {inv.clientName}
                                </Link>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">{new Date(inv.date).toLocaleDateString("fr-FR")}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatCurrency(inv.amount)}</td>
                              <td className="py-2.5 px-3">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                  isVeryLate ? "bg-red-100 text-red-700" : isLate ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700",
                                )}>
                                  {inv.status || "Non payée"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={cn("text-xs font-medium", isVeryLate ? "text-red-600" : isLate ? "text-orange-600" : "text-slate-500")}>
                                  {daysSince}j
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                    <TrendingUp className="h-10 w-10 mb-2" />
                    <p className="text-sm font-medium">Aucune facture impayée</p>
                    <p className="text-xs mt-1">Toutes les factures sont réglées</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "margins" && kpis && (
            <>
              {/* Margin KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Chiffre d'affaires" value={formatCurrency(kpis.totalRevenue)} color="blue" />
                <KpiCard icon={<ShoppingCart className="h-5 w-5" />} label="Coût d'achat" value={formatCurrency(kpis.totalCost)} color="slate" />
                <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Marge brute" value={formatCurrency(kpis.margin)} color="emerald" />
                <KpiCard
                  icon={kpis.marginPercent >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                  label="Taux de marge"
                  value={`${kpis.marginPercent.toFixed(1)}%`}
                  color={kpis.marginPercent >= 20 ? "emerald" : kpis.marginPercent >= 0 ? "amber" : "red"}
                />
              </div>

              {/* Margin by month chart */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">CA, Coûts et Marge par mois</h3>
                {data.monthlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                      <Tooltip formatter={tooltipFmt} />
                      <Bar dataKey="revenue" name="CA" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cost" name="Coûts" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.6} />
                      <Line dataKey="margin" name="Marge" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">Aucune donnée</div>
                )}
              </div>

              {/* Top products table with margins */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Top produits — Ventes et marges</h3>
                {data.topProducts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Produit</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Qté vendue</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">CA</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Coût</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Marge</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">% Marge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((p, i) => {
                          const pctMargin = p.revenue > 0 ? (p.margin / p.revenue) * 100 : 0;
                          return (
                            <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 text-slate-400 font-medium">{i + 1}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-700">{p.name}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600">{formatNumber(p.quantity)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatCurrency(p.revenue)}</td>
                              <td className="py-2.5 px-3 text-right text-red-600">{formatCurrency(p.cost)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">{formatCurrency(p.margin)}</td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                  pctMargin >= 20 ? "bg-emerald-100 text-emerald-700" : pctMargin >= 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700",
                                )}>
                                  {pctMargin.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm text-center py-6">Aucune donnée</p>
                )}
              </div>

              {/* Family margin table */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Marges par famille</h3>
                {data.familyData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Famille</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Lignes</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">CA</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Coût</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Marge</th>
                          <th className="text-right py-2.5 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">% Marge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.familyData.map((f) => {
                          const fMargin = f.revenue - f.cost;
                          const fPct = f.revenue > 0 ? (fMargin / f.revenue) * 100 : 0;
                          return (
                            <tr key={f.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-medium text-slate-700">{f.name}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600">{f.count}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900">{formatCurrency(f.revenue)}</td>
                              <td className="py-2.5 px-3 text-right text-red-600">{formatCurrency(f.cost)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-emerald-600">{formatCurrency(fMargin)}</td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                  fPct >= 20 ? "bg-emerald-100 text-emerald-700" : fPct >= 0 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700",
                                )}>
                                  {fPct.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm text-center py-6">Aucune donnée</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const COLOR_MAP: Record<string, { bg: string; text: string; icon: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-500" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-500" },
  red: { bg: "bg-red-50", text: "text-red-700", icon: "text-red-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", icon: "text-orange-500" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-500" },
  slate: { bg: "bg-slate-50", text: "text-slate-700", icon: "text-slate-500" },
};

function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  const c = COLOR_MAP[color] || COLOR_MAP.slate;
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-4")}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("rounded-lg p-2", c.bg)}>
          <span className={c.icon}>{icon}</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-500 mb-0.5">{label}</p>
      <p className={cn("text-xl font-bold", c.text)}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
