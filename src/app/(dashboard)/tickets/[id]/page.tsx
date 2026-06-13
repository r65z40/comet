"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Send,
  Loader2,
  MessageSquare,
  Building2,
  User,
  Clock,
  Trash2,
  CheckCircle2,
  Circle,
  PauseCircle,
  XCircle,
  RefreshCw,
  Eye,
  EyeOff,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MentionInput from "@/components/ui/MentionInput";

interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorEmail: string | null;
  isInternal: boolean;
  isFromClient: boolean;
  createdAt: string;
}

interface TicketDetail {
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
  client: { id: string; name: string; logoUrl: string | null; email: string | null };
  clientUser: { id: string; name: string; email: string } | null;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

const STATUSES = [
  { value: "Open", label: "Ouvert", icon: <Circle className="h-3.5 w-3.5" />, color: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "Pending", label: "En attente", icon: <PauseCircle className="h-3.5 w-3.5" />, color: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "Resolved", label: "Résolu", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "Closed", label: "Fermé", icon: <XCircle className="h-3.5 w-3.5" />, color: "text-slate-700 bg-slate-100 border-slate-200" },
];

const PRIORITIES = [
  { value: "Low", label: "Basse", color: "bg-emerald-500" },
  { value: "Medium", label: "Moyenne", color: "bg-amber-500" },
  { value: "High", label: "Haute", color: "bg-orange-500" },
  { value: "Critical", label: "Critique", color: "bg-red-500" },
];

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

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [commentText, setCommentText] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/users/list").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setMentionUsers(data);
    }).catch(() => {});
  }, []);

  const fetchTicket = useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`);
    if (res.ok) setTicket(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  async function updateField(field: string, value: string) {
    if (!ticket) return;
    await fetch(`/api/tickets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    fetchTicket();
  }

  async function addComment() {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await fetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText.trim(), isInternal: isInternalComment }),
      });
      setCommentText("");
      setIsInternalComment(false);
      fetchTicket();
    } finally {
      setSendingComment(false);
    }
  }

  async function deleteTicket() {
    if (!confirm("Supprimer ce ticket ?")) return;
    await fetch(`/api/tickets/${id}`, { method: "DELETE" });
    router.push("/tickets");
  }

  async function syncToAtera() {
    setSyncing(true);
    try {
      await fetch(`/api/tickets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _syncAtera: true }),
      });
      // Force re-sync via a direct call
      const res = await fetch(`/api/tickets/${id}`);
      if (res.ok) setTicket(await res.json());
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Ticket introuvable</p>
        <Link href="/tickets" className="text-primary-600 text-sm mt-2 inline-block">Retour</Link>
      </div>
    );
  }

  const currentStatus = STATUSES.find((s) => s.value === ticket.status) || STATUSES[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/tickets" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="h-4 w-4" />
          Retour aux tickets
        </Link>
        <div className="flex items-center gap-2">
          {ticket.ateraId && (
            <a
              href={`https://app.atera.com/new/rm/ticket/${ticket.ateraId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Voir sur Atera
            </a>
          )}
          <button
            onClick={deleteTicket}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title & description */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h1 className="text-lg font-bold text-slate-900">{ticket.title}</h1>
            <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{ticket.description}</p>
            <div className="flex items-center gap-3 mt-4 text-xs text-slate-400">
              <span>Créé {new Date(ticket.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              {ticket.ticketNumber && <span>#{ticket.ticketNumber}</span>}
            </div>
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border border-slate-200">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversation ({ticket.comments.length})
              </h2>
            </div>

            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {ticket.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={cn(
                    "p-4",
                    comment.isInternal ? "bg-amber-50/40" : comment.isFromClient ? "bg-white" : "bg-blue-50/30"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white",
                        comment.isFromClient ? "bg-slate-500" : comment.isInternal ? "bg-amber-500" : "bg-blue-600"
                      )}>
                        {comment.authorName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-slate-800">{comment.authorName}</span>
                      {comment.isFromClient && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">Client</span>
                      )}
                      {comment.isInternal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex items-center gap-0.5">
                          <EyeOff className="h-2.5 w-2.5" /> Interne
                        </span>
                      )}
                      {!comment.isFromClient && !comment.isInternal && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">Support</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
                  </div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap pl-9">
                    {comment.content.split(/(@[\w\s]+?(?:​|$))/).map((part: string, i: number) =>
                      part.startsWith("@") ? (
                        <span key={i} className="bg-primary-100 text-primary-700 rounded px-0.5 font-medium">{part.replace("​", "")}</span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </div>
                </div>
              ))}

              {ticket.comments.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-400">Aucun commentaire</div>
              )}
            </div>

            {/* Reply */}
            <div className="p-4 border-t border-slate-200 bg-slate-50/50">
              <div className="flex gap-3">
                <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={addComment}
                  rows={3}
                  users={mentionUsers}
                  className="flex-1 border-slate-300 px-4 py-2.5 focus:border-primary-500 focus:ring-primary-500 bg-white"
                  placeholder="Répondre au client... (@mention)"
                />
                <div className="flex flex-col gap-2 self-end">
                  <button
                    onClick={addComment}
                    disabled={sendingComment || !commentText.trim()}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Envoyer
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternalComment}
                  onChange={(e) => setIsInternalComment(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs text-slate-500">Note interne (invisible pour le client)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Statut</h3>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => updateField("status", s.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors",
                    ticket.status === s.value ? s.color : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Priorité</h3>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => updateField("priority", p.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors",
                    ticket.priority === p.value
                      ? "border-slate-300 bg-slate-50 text-slate-900"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", p.color)} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase">Informations</h3>

            <div>
              <p className="text-xs text-slate-400 mb-0.5">Client</p>
              <Link href={`/clients/${ticket.client.id}`} className="text-sm font-medium text-primary-600 hover:underline flex items-center gap-1.5">
                {ticket.client.logoUrl && <img src={ticket.client.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover" />}
                {ticket.client.name}
              </Link>
            </div>

            {ticket.clientUser && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Créé par</p>
                <p className="text-sm text-slate-700">{ticket.clientUser.name}</p>
                <p className="text-xs text-slate-400">{ticket.clientUser.email}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-400 mb-0.5">Type</p>
              <select
                value={ticket.type}
                onChange={(e) => updateField("type", e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="Incident">Incident</option>
                <option value="Problem">Problème</option>
                <option value="Request">Demande</option>
              </select>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-0.5">Assigné à</p>
              <input
                type="text"
                value={ticket.assignedTo || ""}
                onChange={(e) => updateField("assignedTo", e.target.value)}
                placeholder="Nom du technicien"
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Atera sync */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Atera</h3>
            {ticket.ateraId ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">
                  Synchronisé — ID Atera : <span className="font-mono font-medium">{ticket.ateraId}</span>
                </p>
                <a
                  href={`https://app.atera.com/new/rm/ticket/${ticket.ateraId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Ouvrir sur Atera
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                {ticket.ateraSyncError && (
                  <div className="flex items-start gap-1.5 text-xs text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {ticket.ateraSyncError}
                  </div>
                )}
                <p className="text-xs text-slate-400">Non synchronisé avec Atera</p>
                <button
                  onClick={syncToAtera}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                >
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Synchroniser
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
