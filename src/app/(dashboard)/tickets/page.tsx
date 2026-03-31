"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Ticket,
  Search,
  Plus,
  Clock,
  MessageSquare,
  Building2,
  User,
  AlertTriangle,
  CheckCircle2,
  Circle,
  PauseCircle,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TicketData {
  id: string;
  ateraId: number | null;
  ticketNumber: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  type: string;
  impact: string;
  assignedTo: string | null;
  ateraSynced: boolean;
  ateraSyncError: string | null;
  client: { id: string; name: string; logoUrl: string | null };
  clientUser: { id: string; name: string; email: string } | null;
  _count: { comments: number };
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  Low: { label: "Basse", color: "text-emerald-600", dot: "bg-emerald-500" },
  Medium: { label: "Moyenne", color: "text-amber-600", dot: "bg-amber-500" },
  High: { label: "Haute", color: "text-orange-600", dot: "bg-orange-500" },
  Critical: { label: "Critique", color: "text-red-600", dot: "bg-red-500" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  Open: { label: "Ouvert", icon: <Circle className="h-3.5 w-3.5" />, color: "text-blue-700", bg: "bg-blue-50" },
  Pending: { label: "En attente", icon: <PauseCircle className="h-3.5 w-3.5" />, color: "text-amber-700", bg: "bg-amber-50" },
  Resolved: { label: "Résolu", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-700", bg: "bg-emerald-50" },
  Closed: { label: "Fermé", icon: <XCircle className="h-3.5 w-3.5" />, color: "text-slate-600", bg: "bg-slate-100" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const res = await fetch(`/api/tickets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets);
        setTotal(data.total);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const openCount = tickets.filter((t) => t.status === "Open").length;
  const pendingCount = tickets.filter((t) => t.status === "Pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
            <Ticket className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Tickets</h1>
            <p className="text-sm text-slate-500">
              {total} ticket{total > 1 ? "s" : ""}
              {openCount > 0 && <span className="text-blue-600"> — {openCount} ouvert{openCount > 1 ? "s" : ""}</span>}
              {pendingCount > 0 && <span className="text-amber-600"> — {pendingCount} en attente</span>}
            </p>
          </div>
        </div>

        <Link
          href="/tickets/new"
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher un ticket..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tous les statuts</option>
          <option value="Open">Ouverts</option>
          <option value="Pending">En attente</option>
          <option value="Resolved">Résolus</option>
          <option value="Closed">Fermés</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Toutes priorités</option>
          <option value="Critical">Critique</option>
          <option value="High">Haute</option>
          <option value="Medium">Moyenne</option>
          <option value="Low">Basse</option>
        </select>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Ticket className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Aucun ticket trouvé</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {tickets.map((ticket) => {
              const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.Open;
              const pr = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.Low;

              return (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group"
                >
                  {/* Priority dot */}
                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", pr.dot)} title={pr.label} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded", st.bg, st.color)}>
                        {st.icon} {st.label}
                      </span>
                      {ticket.ticketNumber && (
                        <span className="text-[10px] text-slate-400">#{ticket.ticketNumber}</span>
                      )}
                      <span className="text-[10px] text-slate-400">{ticket.type}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-primary-600 transition-colors truncate">
                      {ticket.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {ticket.client.name}
                      </span>
                      {ticket.clientUser && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ticket.clientUser.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right info */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(ticket.updatedAt)}
                    </span>
                    <div className="flex items-center gap-2">
                      {ticket._count.comments > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {ticket._count.comments}
                        </span>
                      )}
                      {ticket.ateraId && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                          Atera
                        </span>
                      )}
                      {ticket.ateraSyncError && (
                        <span title={ticket.ateraSyncError}><AlertTriangle className="h-3.5 w-3.5 text-red-400" /></span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
