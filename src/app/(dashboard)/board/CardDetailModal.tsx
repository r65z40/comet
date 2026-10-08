"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  X,
  Pencil,
  Trash2,
  MessageSquare,
  Paperclip,
  Calendar,
  Tag,
  Users,
  Send,
  Upload,
  ExternalLink,
  Plus,
  LinkIcon,
  Download,
  Image as ImageIcon,
  FileText,
  Clock,
  Check,
  History,
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Building2,
  User,
  Flag,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MentionInput from "@/components/ui/MentionInput";

interface CardComment {
  id: string;
  userId: string | null;
  userName: string;
  content: string;
  createdAt: string;
}

interface CardAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface CardTag {
  id: string;
  tag: TagItem;
}

interface CardDetail {
  id: string;
  columnId: string;
  column: { id: string; name: string };
  title: string;
  description: string | null;
  priority: number;
  position: number;
  clientId: string | null;
  client: { id: string; name: string; logoUrl: string | null } | null;
  contactId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null } | null;
  assigneeId: string | null;
  assigneeIds: string | null;
  createdById: string | null;
  dueDate: string | null;
  links: string | null;
  tags: CardTag[];
  comments: CardComment[];
  attachments: CardAttachment[];
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface HistoryEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

interface Props {
  cardId: string;
  users: { id: string; name: string }[];
  onClose: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onUpdate?: () => void;
  dark?: boolean;
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string; darkColor: string; accent: string }> = {
  1: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200", darkColor: "bg-red-900/40 text-red-300 border-red-700", accent: "text-red-400" },
  2: { label: "Normale", color: "bg-orange-50 text-orange-700 border-orange-200", darkColor: "bg-orange-900/40 text-orange-300 border-orange-700", accent: "text-orange-400" },
  3: { label: "Basse", color: "bg-slate-50 text-slate-600 border-slate-200", darkColor: "bg-slate-700 text-slate-300 border-slate-600", accent: "text-slate-400" },
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function CardDetailModal({ cardId, users, onClose, onArchive, onDelete, onUpdate, dark = false }: Props) {
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(3);
  const [editClientId, setEditClientId] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editDueDate, setEditDueDate] = useState("");
  const [editLinks, setEditLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");

  const [editContactId, setEditContactId] = useState("");
  const [clientContacts, setClientContacts] = useState<{ id: string; firstName: string | null; lastName: string | null }[]>([]);

  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6b7280");

  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientSearch, setShowClientSearch] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const fetchCard = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/cards?id=${cardId}`);
      if (res.ok) {
        const data = await res.json();
        setCard(data);
        setEditTitle(data.title);
        setEditDescription(data.description || "");
        setEditPriority(data.priority);
        setEditClientId(data.clientId || "");
        setEditContactId(data.contactId || "");
        setEditAssigneeIds(data.assigneeIds ? JSON.parse(data.assigneeIds) : data.assigneeId ? [data.assigneeId] : []);
        setEditDueDate(data.dueDate ? data.dueDate.split("T")[0] : "");
        setEditLinks(data.links ? JSON.parse(data.links) : []);
        setSelectedTagIds(data.tags.map((t: CardTag) => t.tag.id));
        if (data.clientId) fetchClientContacts(data.clientId);
      }
    } catch {
      console.error("Erreur chargement carte");
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/board/tags");
      if (res.ok) setAllTags(await res.json());
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/history?cardId=${cardId}`);
      if (res.ok) setHistory(await res.json());
    } catch {}
  }, [cardId]);

  const searchClients = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch {}
  }, []);

  const fetchClientContacts = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClientContacts(data.contacts || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchCard(); fetchTags(); fetchHistory(); }, [fetchCard, fetchTags, fetchHistory]);

  useEffect(() => {
    if (clientSearch.length >= 2) {
      const timeout = setTimeout(() => searchClients(clientSearch), 300);
      return () => clearTimeout(timeout);
    }
  }, [clientSearch, searchClients]);

  async function saveCard() {
    await fetch("/api/board/cards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: cardId,
        title: editTitle,
        description: editDescription || null,
        priority: editPriority,
        clientId: editClientId || null,
        contactId: editContactId || null,
        assigneeIds: editAssigneeIds.length > 0 ? editAssigneeIds : [],
        assigneeId: editAssigneeIds[0] || null,
        dueDate: editDueDate || null,
        links: editLinks.length > 0 ? editLinks : null,
        tagIds: selectedTagIds,
      }),
    });
    setEditing(false);
    fetchCard();
    fetchHistory();
    onUpdate?.();
  }

  async function deleteCard() {
    if (!confirm("Supprimer cette carte ?")) return;
    await fetch(`/api/board/cards?id=${cardId}`, { method: "DELETE" });
    onDelete?.();
    onClose();
  }

  async function toggleArchive() {
    const newArchived = !card?.archived;
    await fetch("/api/board/cards/archive", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cardId, archived: newArchived }),
    });
    if (newArchived) { onArchive?.(); onClose(); }
    else { fetchCard(); fetchHistory(); }
  }

  async function addComment() {
    if (!commentText.trim()) return;
    setSendingComment(true);
    await fetch("/api/board/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, content: commentText.trim() }),
    });
    setCommentText("");
    setSendingComment(false);
    fetchCard();
    fetchHistory();
  }

  async function deleteComment(id: string) {
    await fetch(`/api/board/comments?id=${id}`, { method: "DELETE" });
    fetchCard();
  }

  async function uploadFile(file: File) {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("cardId", cardId);
    await fetch("/api/board/attachments", { method: "POST", body: formData });
    setUploading(false);
    fetchCard();
  }

  async function deleteAttachment(id: string) {
    await fetch(`/api/board/attachments?id=${id}`, { method: "DELETE" });
    fetchCard();
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    const res = await fetch("/api/board/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
    });
    if (res.ok) {
      const tag = await res.json();
      setSelectedTagIds((prev) => [...prev, tag.id]);
      setNewTagName("");
      fetchTags();
    }
  }

  function addLink() {
    if (!newLink.trim()) return;
    let url = newLink.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setEditLinks((prev) => [...prev, url]);
    setNewLink("");
  }

  function removeLink(index: number) {
    setEditLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  function isImageType(type: string | null) {
    return type?.startsWith("image/");
  }

  function formatRelativeTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return new Date(dateStr).toLocaleDateString("fr-FR");
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className={cn("animate-spin rounded-full border-b-2", dark ? "h-10 w-10 border-white" : "h-8 w-8 border-white")} />
      </div>
    );
  }

  if (!card) return null;

  const priority = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG[3];
  const creator = users.find((u) => u.id === card.createdById);
  const links: string[] = card.links ? JSON.parse(card.links) : [];
  const currentAssigneeIds: string[] = editing
    ? editAssigneeIds
    : (card.assigneeIds ? JSON.parse(card.assigneeIds) : card.assigneeId ? [card.assigneeId] : []);
  const assignedUsers = users.filter((u) => currentAssigneeIds.includes(u.id));
  const isDueSoon = card.dueDate && new Date(card.dueDate) < new Date(Date.now() + 2 * 86400000);
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();

  const toggleAssignee = async (uid: string, checked: boolean) => {
    const newIds = checked ? [...currentAssigneeIds, uid] : currentAssigneeIds.filter((id: string) => id !== uid);
    if (editing) {
      setEditAssigneeIds(newIds);
    } else {
      await fetch("/api/board/cards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cardId, assigneeIds: newIds, assigneeId: newIds[0] || null }),
      });
      fetchCard();
      fetchHistory();
    }
  };

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4 md:py-8", dark && "scrollbar-touch")}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn(
        "rounded-2xl shadow-2xl w-full mx-3",
        dark ? "bg-slate-800 max-w-5xl" : "bg-white max-w-3xl",
      )}>
        {/* ───── Header ───── */}
        <div className={cn(
          "flex items-start gap-4 border-b",
          dark ? "p-5 border-slate-700/60" : "p-4 border-slate-200",
        )}>
          {card.client?.logoUrl && (
            <img
              src={card.client.logoUrl}
              alt={card.client.name}
              className={cn(
                "object-contain rounded-lg border flex-shrink-0",
                dark ? "h-12 w-12 border-slate-600" : "h-10 w-10 border-slate-200",
              )}
            />
          )}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className={cn(
                  "w-full font-bold border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500",
                  dark ? "text-xl text-white bg-slate-700 border-slate-600 px-4 py-3" : "text-lg text-slate-900 border-slate-300 px-3 py-1.5",
                )}
              />
            ) : (
              <h2 className={cn("font-bold leading-tight", dark ? "text-xl text-white" : "text-lg text-slate-900")}>{card.title}</h2>
            )}
            <div className={cn("flex items-center flex-wrap gap-2 mt-2")}>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full font-medium",
                dark ? "px-3 py-1 text-xs bg-slate-700/80 text-slate-300" : "px-2.5 py-0.5 text-[11px] bg-slate-100 text-slate-500",
              )}>
                {card.column.name}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full font-medium border",
                dark ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
                dark ? priority.darkColor : priority.color,
              )}>
                <Flag className="h-3 w-3" />
                {priority.label}
              </span>
              {card.archived && (
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full font-medium",
                  dark ? "px-3 py-1 text-xs bg-amber-900/30 text-amber-400 border border-amber-700" : "px-2 py-0.5 text-[11px] bg-amber-50 text-amber-600 border border-amber-200",
                )}>
                  <Archive className="h-3 w-3" /> Archivée
                </span>
              )}
            </div>
          </div>
          <div className={cn("flex items-center flex-shrink-0", dark ? "gap-1" : "gap-0.5")}>
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className={cn(
                    "rounded-lg transition-colors",
                    dark ? "p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-blue-400 hover:bg-blue-900/20" : "p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50",
                  )}
                  title="Modifier"
                >
                  <Pencil className={cn(dark ? "h-5 w-5" : "h-4 w-4")} />
                </button>
                <button
                  onClick={toggleArchive}
                  className={cn(
                    "rounded-lg transition-colors",
                    dark
                      ? cn("p-3 min-h-[48px] min-w-[48px] flex items-center justify-center", card.archived ? "text-amber-400 hover:text-amber-300 hover:bg-amber-900/20" : "text-slate-400 hover:text-amber-400 hover:bg-amber-900/20")
                      : cn("p-2", card.archived ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-slate-400 hover:text-amber-500 hover:bg-amber-50"),
                  )}
                  title={card.archived ? "Désarchiver" : "Archiver"}
                >
                  {card.archived ? <ArchiveRestore className={cn(dark ? "h-5 w-5" : "h-4 w-4")} /> : <Archive className={cn(dark ? "h-5 w-5" : "h-4 w-4")} />}
                </button>
                <button
                  onClick={deleteCard}
                  className={cn(
                    "rounded-lg transition-colors",
                    dark ? "p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-900/20" : "p-2 text-slate-400 hover:text-red-600 hover:bg-red-50",
                  )}
                  title="Supprimer"
                >
                  <Trash2 className={cn(dark ? "h-5 w-5" : "h-4 w-4")} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={saveCard}
                  className={cn(
                    "bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium flex items-center gap-2 transition-colors",
                    dark ? "px-5 py-3 text-base min-h-[48px]" : "px-3 py-1.5 text-sm",
                  )}
                >
                  <Check className={cn(dark ? "h-5 w-5" : "h-4 w-4")} />
                  Enregistrer
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className={cn(
                    "rounded-lg transition-colors",
                    dark ? "px-4 py-3 text-base text-slate-400 hover:text-white min-h-[48px]" : "px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700",
                  )}
                >
                  Annuler
                </button>
              </>
            )}
            <div className={cn("border-l ml-1 pl-1", dark ? "border-slate-700" : "border-slate-200")}>
              <button
                onClick={onClose}
                className={cn(
                  "rounded-lg transition-colors",
                  dark ? "p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-700" : "p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                )}
              >
                <X className={cn(dark ? "h-6 w-6" : "h-4 w-4")} />
              </button>
            </div>
          </div>
        </div>

        {/* ───── Body: two-column layout ───── */}
        <div className={cn(
          "flex flex-col md:flex-row",
          dark ? "divide-y md:divide-y-0 md:divide-x divide-slate-700/60" : "divide-y md:divide-y-0 md:divide-x divide-slate-200",
        )}>
          {/* ───── Main content (left) ───── */}
          <div className={cn("flex-1 min-w-0", dark ? "p-5 space-y-5" : "p-4 space-y-4")}>

            {/* Description */}
            <div>
              <label className={cn(
                "font-semibold mb-2 flex items-center gap-2",
                dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
              )}>
                <FileText className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                Description
              </label>
              {editing ? (
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Décrivez cette carte..."
                  rows={dark ? 4 : 3}
                  className={cn(
                    "w-full border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none transition-colors",
                    dark ? "px-4 py-3 text-base bg-slate-700/50 border-slate-600 text-white placeholder-slate-500" : "px-3 py-2 text-sm border-slate-200",
                  )}
                />
              ) : card.description ? (
                <div className={cn(
                  "whitespace-pre-wrap rounded-xl",
                  dark ? "text-base text-slate-200 bg-slate-700/30 px-4 py-3" : "text-sm text-slate-700 bg-slate-50 px-3 py-2.5 rounded-lg",
                )}>
                  {card.description}
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className={cn(
                    "w-full text-left border border-dashed rounded-xl transition-colors",
                    dark ? "px-4 py-4 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-400 hover:bg-slate-700/20" : "px-3 py-3 text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-500 hover:bg-slate-50",
                  )}
                >
                  <span className={cn("flex items-center gap-2", dark ? "text-sm" : "text-xs")}>
                    <Plus className="h-4 w-4" />
                    Ajouter une description...
                  </span>
                </button>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className={cn(
                "font-semibold mb-2 flex items-center gap-2",
                dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
              )}>
                <Tag className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                Tags
              </label>
              <div className={cn("flex flex-wrap", dark ? "gap-2" : "gap-1.5")}>
                {(editing ? allTags.filter((t) => selectedTagIds.includes(t.id)) : card.tags.map((t) => t.tag)).map((tag) => (
                  <span
                    key={tag.id}
                    className={cn(
                      "inline-flex items-center font-medium rounded-full",
                      dark ? "gap-2 px-3.5 py-1.5 text-sm" : "gap-1 px-2.5 py-0.5 text-xs",
                    )}
                    style={{ backgroundColor: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}44` }}
                  >
                    {tag.name}
                    {editing && (
                      <button onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))} className="hover:opacity-70 ml-0.5">
                        <X className={cn(dark ? "h-3.5 w-3.5" : "h-3 w-3")} />
                      </button>
                    )}
                  </span>
                ))}
                {card.tags.length === 0 && !editing && (
                  <span className={cn("italic", dark ? "text-sm text-slate-600" : "text-xs text-slate-400")}>Aucun tag</span>
                )}
                {editing && (
                  <button
                    onClick={() => setShowTagPicker(!showTagPicker)}
                    className={cn(
                      "inline-flex items-center border border-dashed rounded-full transition-colors",
                      dark ? "gap-1.5 px-3.5 py-1.5 text-sm text-slate-400 border-slate-600 hover:border-slate-400 hover:text-slate-300" : "gap-1 px-2.5 py-0.5 text-xs text-slate-500 border-slate-300 hover:border-slate-400",
                    )}
                  >
                    <Plus className="h-3 w-3" />
                    Tag
                  </button>
                )}
              </div>
              {editing && showTagPicker && (
                <div className={cn(
                  "border rounded-xl mt-3",
                  dark ? "bg-slate-700/30 border-slate-600 p-4 space-y-3" : "bg-slate-50 border-slate-200 p-3 space-y-2",
                )}>
                  <div className={cn("flex flex-wrap", dark ? "gap-2" : "gap-1")}>
                    {allTags.filter((t) => !selectedTagIds.includes(t.id)).map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagIds((prev) => [...prev, tag.id])}
                        className={cn(
                          "rounded-full border transition-colors",
                          dark ? "px-3 py-2 text-sm border-slate-600 hover:border-slate-400 min-h-[40px]" : "px-2 py-0.5 text-xs border-slate-200 hover:border-slate-400",
                        )}
                        style={{ color: tag.color }}
                      >
                        + {tag.name}
                      </button>
                    ))}
                  </div>
                  <div className={cn("flex items-center", dark ? "gap-2" : "gap-1.5")}>
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className={cn("rounded cursor-pointer border-0", dark ? "w-10 h-10" : "w-7 h-7")}
                    />
                    <input
                      type="text"
                      placeholder="Nouveau tag..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createTag()}
                      className={cn(
                        "flex-1 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500",
                        dark ? "px-4 py-2.5 text-sm bg-slate-700 border-slate-600 text-white placeholder-slate-500 min-h-[44px]" : "px-2 py-1 text-xs border-slate-200",
                      )}
                    />
                    <button onClick={createTag} className={cn(
                      "bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium",
                      dark ? "px-4 py-2.5 text-sm min-h-[44px]" : "px-2 py-1 text-xs",
                    )}>
                      Créer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Links */}
            {(links.length > 0 || editing) && (
              <div>
                <label className={cn(
                  "font-semibold mb-2 flex items-center gap-2",
                  dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
                )}>
                  <LinkIcon className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                  Liens
                </label>
                <div className={cn(dark ? "space-y-2" : "space-y-1")}>
                  {(editing ? editLinks : links).map((link, i) => (
                    <div key={i} className={cn(
                      "flex items-center gap-2 group rounded-lg transition-colors",
                      dark ? "px-3 py-2 hover:bg-slate-700/40" : "px-2 py-1 hover:bg-slate-50",
                    )}>
                      <ExternalLink className={cn("flex-shrink-0", dark ? "h-4 w-4 text-slate-500" : "h-3 w-3 text-slate-400")} />
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "hover:underline truncate",
                          dark ? "text-base text-primary-400 hover:text-primary-300" : "text-sm text-primary-600 hover:text-primary-700",
                        )}
                      >
                        {link.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                      {editing && (
                        <button
                          onClick={() => removeLink(i)}
                          className={cn(
                            "ml-auto flex-shrink-0",
                            dark ? "text-slate-500 hover:text-red-400 p-2 min-h-[44px]" : "text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100",
                          )}
                        >
                          <X className={cn(dark ? "h-4 w-4" : "h-3.5 w-3.5")} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {editing && (
                  <div className={cn("flex mt-2", dark ? "gap-2" : "gap-1.5")}>
                    <input
                      type="text"
                      placeholder="https://..."
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addLink()}
                      className={cn(
                        "flex-1 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500",
                        dark ? "px-4 py-3 text-base bg-slate-700 border-slate-600 text-white placeholder-slate-500 min-h-[48px]" : "px-2 py-1.5 text-sm border-slate-200",
                      )}
                    />
                    <button onClick={addLink} className={cn(
                      "border rounded-lg font-medium transition-colors",
                      dark ? "px-5 py-3 text-base text-primary-400 border-primary-700 hover:bg-primary-900/20 min-h-[48px]" : "px-3 py-1.5 text-sm text-primary-600 border-primary-200 hover:bg-primary-50",
                    )}>
                      Ajouter
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Attachments */}
            <div>
              <div className={cn("flex items-center justify-between mb-2")}>
                <label className={cn(
                  "font-semibold flex items-center gap-2",
                  dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
                )}>
                  <Paperclip className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                  Pièces jointes
                  {card.attachments.length > 0 && (
                    <span className={cn(
                      "rounded-full font-medium",
                      dark ? "bg-slate-700 text-slate-400 px-2 py-0.5 text-xs ml-1" : "bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[10px] ml-0.5",
                    )}>
                      {card.attachments.length}
                    </span>
                  )}
                </label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors",
                    dark ? "px-3 py-2 text-sm text-primary-400 hover:bg-primary-900/20 min-h-[40px]" : "px-2 py-1 text-xs text-primary-600 hover:bg-primary-50",
                  )}
                >
                  <Upload className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                  {uploading ? "Envoi..." : "Ajouter"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadFile(file);
                    e.target.value = "";
                  }}
                />
              </div>
              {card.attachments.length > 0 ? (
                <div className={cn(
                  "grid gap-2",
                  card.attachments.some((a) => isImageType(a.fileType))
                    ? (dark ? "grid-cols-2" : "grid-cols-2") : "grid-cols-1",
                )}>
                  {card.attachments.map((att) => (
                    <div key={att.id} className={cn(
                      "flex items-center rounded-xl group transition-colors",
                      dark ? "gap-3 p-3 bg-slate-700/30 hover:bg-slate-700/50" : "gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100",
                    )}>
                      {isImageType(att.fileType) ? (
                        <img
                          src={att.fileUrl}
                          alt={att.fileName}
                          className={cn(
                            "object-cover rounded-lg",
                            dark ? "w-14 h-14" : "w-12 h-12",
                          )}
                        />
                      ) : (
                        <div className={cn(
                          "flex items-center justify-center rounded-lg",
                          dark ? "w-14 h-14 bg-slate-600/50" : "w-12 h-12 bg-slate-200",
                        )}>
                          <FileText className={cn(dark ? "h-6 w-6 text-slate-400" : "h-5 w-5 text-slate-500")} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <a href={att.fileUrl} target="_blank" rel="noopener noreferrer"
                          className={cn("hover:text-primary-500 truncate block", dark ? "text-sm text-slate-200" : "text-sm text-slate-700")}
                        >
                          {att.fileName}
                        </a>
                        <p className={cn(dark ? "text-xs text-slate-500" : "text-xs text-slate-400")}>{formatFileSize(att.fileSize)}</p>
                      </div>
                      <div className={cn("flex items-center", dark ? "gap-1" : "gap-0.5 opacity-0 group-hover:opacity-100")}>
                        <a href={att.fileUrl} download className={cn("rounded-lg", dark ? "p-2.5 text-slate-400 hover:text-white" : "p-1.5 text-slate-400 hover:text-slate-600")}>
                          <Download className={cn(dark ? "h-4 w-4" : "h-3.5 w-3.5")} />
                        </a>
                        <button onClick={() => deleteAttachment(att.id)} className={cn("rounded-lg", dark ? "p-2.5 text-slate-400 hover:text-red-400" : "p-1.5 text-slate-400 hover:text-red-600")}>
                          <Trash2 className={cn(dark ? "h-4 w-4" : "h-3.5 w-3.5")} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={cn(
                  "flex flex-col items-center justify-center rounded-xl border border-dashed py-4",
                  dark ? "border-slate-700 text-slate-600" : "border-slate-200 text-slate-400",
                )}>
                  <Paperclip className={cn(dark ? "h-6 w-6 mb-1" : "h-5 w-5 mb-1")} />
                  <span className={cn(dark ? "text-sm" : "text-xs")}>Aucune pièce jointe</span>
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <label className={cn(
                "font-semibold mb-3 flex items-center gap-2",
                dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
              )}>
                <MessageSquare className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                Commentaires
                {card.comments.length > 0 && (
                  <span className={cn(
                    "rounded-full font-medium",
                    dark ? "bg-slate-700 text-slate-400 px-2 py-0.5 text-xs ml-1" : "bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[10px] ml-0.5",
                  )}>
                    {card.comments.length}
                  </span>
                )}
              </label>

              {/* Comment input */}
              <div className={cn(
                "flex items-start rounded-xl border transition-colors",
                dark ? "gap-3 bg-slate-700/30 border-slate-600 p-3 focus-within:border-primary-500/50" : "gap-2 bg-slate-50 border-slate-200 p-2 focus-within:border-primary-300",
              )}>
                <MentionInput
                  value={commentText}
                  onChange={setCommentText}
                  onSubmit={addComment}
                  placeholder="Écrire un commentaire... (@mention)"
                  rows={dark ? 2 : 2}
                  users={users}
                  className={cn(
                    "flex-1 border-0 bg-transparent focus:ring-0",
                    dark ? "px-2 py-1 text-base text-white placeholder-slate-500" : "px-2 py-1 text-sm",
                  )}
                />
                <button
                  onClick={addComment}
                  disabled={!commentText.trim() || sendingComment}
                  className={cn(
                    "self-end bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-30 transition-colors flex-shrink-0",
                    dark ? "p-3 min-h-[48px] min-w-[48px] flex items-center justify-center" : "p-2",
                  )}
                >
                  <Send className={cn(dark ? "h-5 w-5" : "h-4 w-4")} />
                </button>
              </div>

              {/* Comment list */}
              {card.comments.length > 0 && (
                <div className={cn("mt-4", dark ? "space-y-4" : "space-y-3")}>
                  {card.comments.map((comment) => (
                    <div key={comment.id} className={cn(
                      "group flex gap-3 rounded-xl transition-colors",
                      dark ? "p-3 hover:bg-slate-700/20" : "p-2 hover:bg-slate-50",
                    )}>
                      <div className={cn(
                        "rounded-full flex items-center justify-center font-bold text-white flex-shrink-0",
                        dark ? "w-9 h-9 text-sm" : "w-7 h-7 text-[11px]",
                        getAvatarColor(comment.userName),
                      )}>
                        {comment.userName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-semibold", dark ? "text-sm text-slate-200" : "text-sm text-slate-700")}>{comment.userName}</span>
                          <span className={cn(dark ? "text-xs text-slate-500" : "text-xs text-slate-400")}>{formatRelativeTime(comment.createdAt)}</span>
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className={cn(
                              "ml-auto transition-opacity",
                              dark ? "text-slate-600 hover:text-red-400 p-1" : "text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100",
                            )}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className={cn("whitespace-pre-wrap mt-1", dark ? "text-sm text-slate-300" : "text-sm text-slate-600")}>
                          {comment.content.split(/(@[\w\s]+?(?:​|$))/).map((part, i) =>
                            part.startsWith("@") ? (
                              <span key={i} className={cn(
                                "rounded px-1 font-medium",
                                dark ? "bg-primary-900/40 text-primary-300" : "bg-primary-100 text-primary-700",
                              )}>{part.replace("​", "")}</span>
                            ) : (
                              <span key={i}>{part}</span>
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History — collapsible */}
            {history.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={cn(
                    "w-full flex items-center gap-2 font-semibold transition-colors",
                    dark ? "text-sm text-slate-400 hover:text-slate-300 py-2" : "text-xs text-slate-500 hover:text-slate-600 py-1 uppercase tracking-wide",
                  )}
                >
                  {showHistory
                    ? <ChevronDown className={cn(dark ? "h-4 w-4" : "h-3.5 w-3.5")} />
                    : <ChevronRight className={cn(dark ? "h-4 w-4" : "h-3.5 w-3.5")} />}
                  <History className={cn(dark ? "h-4 w-4" : "h-3.5 w-3.5")} />
                  Historique
                  <span className={cn(
                    "rounded-full font-medium",
                    dark ? "bg-slate-700 text-slate-500 px-2 py-0.5 text-xs" : "bg-slate-100 text-slate-400 px-1.5 py-0.5 text-[10px]",
                  )}>
                    {history.length}
                  </span>
                </button>
                {showHistory && (
                  <div className={cn(
                    "overflow-y-auto border-l-2 ml-2 pl-3 mt-2",
                    dark ? "max-h-64 space-y-2 scrollbar-touch border-slate-700" : "max-h-48 space-y-1.5 border-slate-200",
                  )}>
                    {history.map((entry) => (
                      <div key={entry.id} className={cn("flex items-start gap-2", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                        <div className={cn("rounded-full flex-shrink-0 mt-1.5", dark ? "w-2 h-2 bg-slate-600" : "w-1.5 h-1.5 bg-slate-300")} />
                        <div className="flex-1 min-w-0">
                          <span className={cn("font-medium", dark ? "text-slate-300" : "text-slate-600")}>{entry.userName || "Système"}</span>
                          {" "}
                          {entry.action === "CREATE" && "a créé la carte"}
                          {entry.action === "UPDATE" && entry.field === "title" && (
                            <>a renommé la carte de &quot;{entry.oldValue}&quot; en &quot;{entry.newValue}&quot;</>
                          )}
                          {entry.action === "UPDATE" && entry.field === "priority" && (
                            <>a changé la priorité de &quot;{entry.oldValue}&quot; à &quot;{entry.newValue}&quot;</>
                          )}
                          {entry.action === "UPDATE" && entry.field === "assignee" && (
                            <>a changé l&apos;assignation{entry.oldValue ? ` de "${entry.oldValue}"` : ""} {entry.newValue ? `à "${entry.newValue}"` : "à non assigné"}</>
                          )}
                          {entry.action === "UPDATE" && entry.field === "client" && (
                            <>a changé le client{entry.oldValue ? ` de "${entry.oldValue}"` : ""} {entry.newValue ? `à "${entry.newValue}"` : ""}</>
                          )}
                          {entry.action === "UPDATE" && entry.field === "dueDate" && (
                            <>a modifié la date limite{entry.newValue ? ` au ${new Date(entry.newValue).toLocaleDateString("fr-FR")}` : " (retirée)"}</>
                          )}
                          {entry.action === "UPDATE" && entry.field === "description" && "a modifié la description"}
                          {entry.action === "MOVE" && (
                            <>a déplacé la carte de &quot;{entry.oldValue}&quot; vers &quot;{entry.newValue}&quot;</>
                          )}
                          {entry.action === "COMMENT" && "a ajouté un commentaire"}
                          {entry.action === "ASSIGN" && (
                            <>a assigné la carte à &quot;{entry.newValue}&quot;</>
                          )}
                          <span className={cn("ml-1", dark ? "text-slate-600" : "text-slate-400")}>
                            · {formatRelativeTime(entry.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ───── Sidebar (right) ───── */}
          <div className={cn(
            "flex-shrink-0 md:w-72 lg:w-80",
            dark ? "p-5 space-y-4" : "p-4 space-y-3",
          )}>
            {/* Priority (edit mode) */}
            {editing && (
              <div>
                <label className={cn(
                  "font-semibold mb-2 flex items-center gap-2",
                  dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
                )}>
                  <Flag className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                  Priorité
                </label>
                <div className={cn("flex", dark ? "gap-2" : "gap-1")}>
                  {[1, 2, 3].map((p) => (
                    <button
                      key={p}
                      onClick={() => setEditPriority(p)}
                      className={cn(
                        "flex-1 rounded-lg border font-medium transition-all",
                        dark ? "px-3 py-3 text-sm min-h-[48px]" : "px-2 py-1.5 text-xs",
                        editPriority === p
                          ? cn(dark ? PRIORITY_CONFIG[p].darkColor : PRIORITY_CONFIG[p].color, "ring-2 ring-white/10")
                          : (dark ? "bg-slate-700/50 text-slate-400 border-slate-600 hover:border-slate-500" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"),
                      )}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assignees */}
            <div>
              <label className={cn(
                "font-semibold mb-2 flex items-center gap-2",
                dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
              )}>
                <Users className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                Assigné à
              </label>
              {/* Show assigned avatar row in view mode */}
              {!editing && assignedUsers.length > 0 && (
                <div className={cn("flex flex-wrap gap-2 mb-2")}>
                  {assignedUsers.map((u) => (
                    <div key={u.id} className={cn(
                      "flex items-center gap-2 rounded-lg",
                      dark ? "bg-slate-700/40 px-3 py-2" : "bg-slate-50 px-2 py-1",
                    )}>
                      <div className={cn(
                        "rounded-full flex items-center justify-center font-bold text-white flex-shrink-0",
                        dark ? "w-7 h-7 text-xs" : "w-5 h-5 text-[9px]",
                        getAvatarColor(u.name),
                      )}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className={cn(dark ? "text-sm text-slate-200" : "text-xs text-slate-700")}>{u.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {!editing && assignedUsers.length === 0 && (
                <p className={cn("italic mb-2", dark ? "text-sm text-slate-600" : "text-xs text-slate-400")}>Non assigné</p>
              )}
              <div className={cn(
                "overflow-y-auto border rounded-xl",
                dark ? "max-h-40 border-slate-700 p-1.5 space-y-0.5 scrollbar-touch" : "max-h-32 border-slate-200 p-1 space-y-0.5",
              )}>
                {users.map((u) => (
                  <label key={u.id} className={cn(
                    "flex items-center rounded-lg cursor-pointer transition-colors",
                    dark ? "gap-3 px-3 py-2.5 hover:bg-slate-700/50 min-h-[44px]" : "gap-2 px-2 py-1 hover:bg-slate-50",
                  )}>
                    <input
                      type="checkbox"
                      checked={currentAssigneeIds.includes(u.id)}
                      onChange={(e) => toggleAssignee(u.id, e.target.checked)}
                      className={cn(
                        "rounded border-slate-300 text-primary-600 focus:ring-primary-500",
                        dark ? "h-5 w-5" : "h-3.5 w-3.5",
                      )}
                    />
                    <div className={cn(
                      "rounded-full flex items-center justify-center font-bold text-white flex-shrink-0",
                      dark ? "w-6 h-6 text-[10px]" : "w-4 h-4 text-[8px]",
                      getAvatarColor(u.name),
                    )}>
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className={cn(dark ? "text-sm text-slate-200" : "text-xs text-slate-700")}>{u.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <label className={cn(
                "font-semibold mb-2 flex items-center gap-2",
                dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
              )}>
                <Calendar className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                Date limite
              </label>
              {editing ? (
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className={cn(
                    "w-full border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500",
                    dark ? "px-4 py-3 text-base bg-slate-700/50 border-slate-600 text-white min-h-[48px]" : "px-2 py-1.5 text-sm border-slate-200",
                  )}
                />
              ) : card.dueDate ? (
                <div className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2",
                  isOverdue
                    ? (dark ? "bg-red-900/20 text-red-400" : "bg-red-50 text-red-600")
                    : isDueSoon
                      ? (dark ? "bg-amber-900/20 text-amber-400" : "bg-amber-50 text-amber-600")
                      : (dark ? "bg-slate-700/30 text-slate-200" : "bg-slate-50 text-slate-700"),
                )}>
                  {isOverdue && <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                  <span className={cn(dark ? "text-sm" : "text-sm")}>
                    {new Date(card.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                  </span>
                </div>
              ) : (
                <p className={cn("italic", dark ? "text-sm text-slate-600" : "text-xs text-slate-400")}>Aucune</p>
              )}
            </div>

            {/* Client */}
            <div>
              <label className={cn(
                "font-semibold mb-2 flex items-center gap-2",
                dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
              )}>
                <Building2 className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                Client
              </label>
              {editing ? (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setShowClientSearch(true); }}
                    onFocus={() => setShowClientSearch(true)}
                    className={cn(
                      "w-full border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500",
                      dark ? "px-4 py-3 text-base bg-slate-700/50 border-slate-600 text-white placeholder-slate-500 min-h-[48px]" : "px-2 py-1.5 text-sm border-slate-200",
                    )}
                  />
                  {editClientId && (
                    <button
                      onClick={() => { setEditClientId(""); setClientSearch(""); setEditContactId(""); setClientContacts([]); }}
                      className={cn("absolute right-3 top-1/2 -translate-y-1/2", dark ? "text-slate-400 hover:text-white p-1" : "text-slate-400 hover:text-slate-600")}
                    >
                      <X className={cn(dark ? "h-5 w-5" : "h-3.5 w-3.5")} />
                    </button>
                  )}
                  {showClientSearch && clients.length > 0 && (
                    <div className={cn("absolute z-10 top-full mt-1 w-full border rounded-xl shadow-lg max-h-48 overflow-y-auto", dark ? "bg-slate-700 border-slate-600" : "bg-white border-slate-200")}>
                      {clients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setEditClientId(c.id); setClientSearch(c.name); setShowClientSearch(false); setEditContactId(""); fetchClientContacts(c.id); }}
                          className={cn("w-full text-left", dark ? "px-4 py-3 text-base text-slate-200 hover:bg-slate-600 min-h-[44px]" : "px-3 py-1.5 text-sm hover:bg-slate-50")}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : card.client ? (
                <Link
                  href={`/clients/${card.client.id}`}
                  className={cn(
                    "flex items-center gap-2 rounded-lg transition-colors",
                    dark ? "px-3 py-2 bg-slate-700/30 hover:bg-slate-700/50 text-primary-400 hover:text-primary-300" : "px-2 py-1.5 bg-slate-50 hover:bg-slate-100 text-primary-600",
                  )}
                >
                  {card.client.logoUrl && (
                    <img src={card.client.logoUrl} alt="" className="w-5 h-5 rounded object-contain" />
                  )}
                  <span className={cn(dark ? "text-sm" : "text-sm")}>{card.client.name}</span>
                  <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                </Link>
              ) : (
                <p className={cn("italic", dark ? "text-sm text-slate-600" : "text-xs text-slate-400")}>Aucun</p>
              )}
            </div>

            {/* Contact */}
            <div>
              <label className={cn(
                "font-semibold mb-2 flex items-center gap-2",
                dark ? "text-sm text-slate-300" : "text-xs text-slate-600 uppercase tracking-wide",
              )}>
                <User className={cn(dark ? "h-4 w-4 text-slate-500" : "h-3.5 w-3.5 text-slate-400")} />
                Contact
              </label>
              {editing ? (
                editClientId && clientContacts.length > 0 ? (
                  <select
                    value={editContactId}
                    onChange={(e) => setEditContactId(e.target.value)}
                    className={cn(
                      "w-full border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary-500",
                      dark ? "px-4 py-3 text-base bg-slate-700/50 border-slate-600 text-white min-h-[48px]" : "px-2 py-1.5 text-sm border-slate-200",
                    )}
                  >
                    <option value="">Aucun</option>
                    {clientContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Sans nom"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className={cn("italic", dark ? "text-sm text-slate-500" : "text-xs text-slate-400")}>
                    {editClientId ? "Aucun contact" : "Sélectionnez un client"}
                  </p>
                )
              ) : card.contact ? (
                <p className={cn(
                  "rounded-lg",
                  dark ? "text-sm text-slate-200 bg-slate-700/30 px-3 py-2" : "text-sm text-slate-700 bg-slate-50 px-2 py-1.5",
                )}>
                  {[card.contact.firstName, card.contact.lastName].filter(Boolean).join(" ") || "Sans nom"}
                </p>
              ) : (
                <p className={cn("italic", dark ? "text-sm text-slate-600" : "text-xs text-slate-400")}>Aucun</p>
              )}
            </div>

            {/* Footer info */}
            <div className={cn(
              "flex items-center gap-2 pt-3 border-t",
              dark ? "text-xs text-slate-600 border-slate-700/60" : "text-[11px] text-slate-400 border-slate-200",
            )}>
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>Créée {formatRelativeTime(card.createdAt)}</span>
              {creator && <span>par {creator.name}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
