"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  MessageSquare,
  Clock,
  AlertTriangle,
  ChevronLeft,
  Send,
  Loader2,
  Search,
  Filter,
  Ticket,
  CheckCircle2,
  Circle,
  PauseCircle,
  XCircle,
} from "lucide-react";

interface TicketData {
  id: string;
  ateraId: number | null;
  ticketNumber: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  type: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { comments: number };
}

interface Comment {
  id: string;
  content: string;
  authorName: string;
  isFromClient: boolean;
  createdAt: string;
}

interface TicketDetail extends TicketData {
  comments: Comment[];
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  Low: { label: "Basse", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  Medium: { label: "Moyenne", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  High: { label: "Haute", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  Critical: { label: "Critique", color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  Open: { label: "Ouvert", icon: <Circle className="h-3.5 w-3.5" />, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  Pending: { label: "En attente", icon: <PauseCircle className="h-3.5 w-3.5" />, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  Resolved: { label: "Résolu", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  Closed: { label: "Fermé", icon: <XCircle className="h-3.5 w-3.5" />, color: "text-slate-700", bg: "bg-slate-100 border-slate-200" },
};

const TYPE_LABELS: Record<string, string> = {
  Incident: "Incident",
  Problem: "Problème",
  Request: "Demande",
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

export default function PortalTicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "detail" | "create">("list");
  const [selectedTicket, setSelectedTicket] = useState<TicketDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Create form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newType, setNewType] = useState("Incident");
  const [creating, setCreating] = useState(false);

  // Comment
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/portal/tickets?${params}`);
      if (res.ok) setTickets(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  async function openTicket(id: string) {
    const res = await fetch(`/api/portal/tickets/${id}`);
    if (res.ok) {
      setSelectedTicket(await res.json());
      setView("detail");
    }
  }

  async function createTicket() {
    if (!newTitle.trim() || !newDescription.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/portal/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          priority: newPriority,
          type: newType,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        setNewPriority("Medium");
        setNewType("Incident");
        setView("list");
        fetchTickets();
      }
    } catch {} finally {
      setCreating(false);
    }
  }

  async function addComment() {
    if (!commentText.trim() || !selectedTicket) return;
    setSendingComment(true);
    try {
      const res = await fetch(`/api/portal/tickets/${selectedTicket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (res.ok) {
        setCommentText("");
        // Refresh ticket
        const ticketRes = await fetch(`/api/portal/tickets/${selectedTicket.id}`);
        if (ticketRes.ok) setSelectedTicket(await ticketRes.json());
      }
    } catch {} finally {
      setSendingComment(false);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.ticketNumber?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ─── CREATE VIEW ──────────────────────────────
  if (view === "create") {
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setView("list")} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ChevronLeft className="h-4 w-4" />
          Retour aux tickets
        </button>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-100">
            <h1 className="text-lg font-bold text-slate-900">Nouveau ticket</h1>
            <p className="text-sm text-slate-500 mt-1">Décrivez votre problème ou demande</p>
          </div>

          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sujet *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Résumez votre demande en une phrase"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Incident">Incident</option>
                  <option value="Problem">Problème</option>
                  <option value="Request">Demande</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Priorité</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Low">Basse</option>
                  <option value="Medium">Moyenne</option>
                  <option value="High">Haute</option>
                  <option value="Critical">Critique</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={6}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder="Décrivez le problème en détail : contexte, étapes pour reproduire, message d'erreur..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setView("list")}
                className="px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={createTicket}
                disabled={creating || !newTitle.trim() || !newDescription.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer le ticket
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── DETAIL VIEW ──────────────────────────────
  if (view === "detail" && selectedTicket) {
    const st = STATUS_CONFIG[selectedTicket.status] || STATUS_CONFIG.Open;
    const pr = PRIORITY_CONFIG[selectedTicket.priority] || PRIORITY_CONFIG.Low;

    return (
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => { setView("list"); setSelectedTicket(null); }}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour aux tickets
        </button>

        {/* Ticket header */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-4">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-slate-900">{selectedTicket.title}</h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {selectedTicket.ticketNumber && (
                    <span className="text-xs text-slate-400">#{selectedTicket.ticketNumber}</span>
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${st.bg} ${st.color}`}>
                    {st.icon} {st.label}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${pr.bg} ${pr.color}`}>
                    {pr.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {TYPE_LABELS[selectedTicket.type] || selectedTicket.type}
                  </span>
                  <span className="text-xs text-slate-400">
                    Créé {new Date(selectedTicket.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comments / conversation */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Conversation ({selectedTicket.comments.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {selectedTicket.comments.map((comment) => (
              <div key={comment.id} className={`p-4 ${comment.isFromClient ? "bg-white" : "bg-blue-50/30"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${comment.isFromClient ? "bg-slate-500" : "bg-blue-600"}`}>
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-800">{comment.authorName}</span>
                    {!comment.isFromClient && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Support</span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap pl-9">{comment.content}</div>
              </div>
            ))}

            {selectedTicket.comments.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">Aucun message</div>
            )}
          </div>

          {/* Reply box */}
          {selectedTicket.status !== "Closed" && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50">
              <div className="flex gap-3">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={3}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none bg-white"
                  placeholder="Écrivez votre réponse..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment();
                  }}
                />
                <button
                  onClick={addComment}
                  disabled={sendingComment || !commentText.trim()}
                  className="self-end flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Envoyer
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Ctrl+Entrée pour envoyer</p>
            </div>
          )}

          {selectedTicket.status === "Closed" && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
              Ce ticket est fermé.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ──────────────────────────────
  const openCount = tickets.filter((t) => t.status === "Open").length;
  const pendingCount = tickets.filter((t) => t.status === "Pending").length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Ticket className="h-5 w-5 text-blue-600" />
            Mes tickets
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {tickets.length} ticket{tickets.length > 1 ? "s" : ""}
            {openCount > 0 && <span className="text-blue-600"> — {openCount} ouvert{openCount > 1 ? "s" : ""}</span>}
            {pendingCount > 0 && <span className="text-amber-600"> — {pendingCount} en attente</span>}
          </p>
        </div>
        <button
          onClick={() => setView("create")}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouveau ticket
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {[
            { value: "all", label: "Tous" },
            { value: "Open", label: "Ouverts" },
            { value: "Pending", label: "En attente" },
            { value: "Resolved", label: "Résolus" },
            { value: "Closed", label: "Fermés" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === f.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket list */}
      <div className="space-y-2">
        {filteredTickets.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Ticket className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Aucun ticket</p>
            <button
              onClick={() => setView("create")}
              className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Créer votre premier ticket
            </button>
          </div>
        )}

        {filteredTickets.map((ticket) => {
          const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.Open;
          const pr = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.Low;

          return (
            <button
              key={ticket.id}
              onClick={() => openTicket(ticket.id)}
              className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${st.bg} ${st.color}`}>
                      {st.icon} {st.label}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${pr.bg} ${pr.color}`}>
                      {pr.label}
                    </span>
                    {ticket.ticketNumber && (
                      <span className="text-[10px] text-slate-400">#{ticket.ticketNumber}</span>
                    )}
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mt-1.5 group-hover:text-blue-600 transition-colors line-clamp-1">
                    {ticket.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo(ticket.updatedAt)}
                  </span>
                  {ticket._count.comments > 0 && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {ticket._count.comments}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
