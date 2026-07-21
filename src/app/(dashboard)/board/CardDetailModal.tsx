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
  dark?: boolean;
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string; darkColor: string }> = {
  1: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200", darkColor: "bg-red-900/40 text-red-300 border-red-700" },
  2: { label: "Normale", color: "bg-orange-50 text-orange-700 border-orange-200", darkColor: "bg-orange-900/40 text-orange-300 border-orange-700" },
  3: { label: "Basse", color: "bg-slate-50 text-slate-600 border-slate-200", darkColor: "bg-slate-700 text-slate-300 border-slate-600" },
};

export default function CardDetailModal({ cardId, users, onClose, dark = false }: Props) {
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(3);
  const [editClientId, setEditClientId] = useState("");
  const [editAssigneeIds, setEditAssigneeIds] = useState<string[]>([]);
  const [editDueDate, setEditDueDate] = useState("");
  const [editLinks, setEditLinks] = useState<string[]>([]);
  const [newLink, setNewLink] = useState("");

  // Contact state
  const [editContactId, setEditContactId] = useState("");
  const [clientContacts, setClientContacts] = useState<{ id: string; firstName: string | null; lastName: string | null }[]>([]);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  // Tag state
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6b7280");

  // Client search
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientSearch, setShowClientSearch] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const fetchCard = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/cards?id=${cardId}`);
      if (res.ok) {
        const data = await res.json();
        setCard(data);
        // Initialize edit state
        setEditTitle(data.title);
        setEditDescription(data.description || "");
        setEditPriority(data.priority);
        setEditClientId(data.clientId || "");
        setEditContactId(data.contactId || "");
        setEditAssigneeIds(data.assigneeIds ? JSON.parse(data.assigneeIds) : data.assigneeId ? [data.assigneeId] : []);
        setEditDueDate(data.dueDate ? data.dueDate.split("T")[0] : "");
        setEditLinks(data.links ? JSON.parse(data.links) : []);
        setSelectedTagIds(data.tags.map((t: CardTag) => t.tag.id));
        // Fetch contacts for client
        if (data.clientId) {
          fetchClientContacts(data.clientId);
        }
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
    } catch {
      // ignore
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/board/history?cardId=${cardId}`);
      if (res.ok) setHistory(await res.json());
    } catch {
      // ignore
    }
  }, [cardId]);

  const searchClients = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchClientContacts = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setClientContacts(data.contacts || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCard();
    fetchTags();
    fetchHistory();
  }, [fetchCard, fetchTags, fetchHistory]);

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
  }

  async function deleteCard() {
    if (!confirm("Supprimer cette carte ?")) return;
    await fetch(`/api/board/cards?id=${cardId}`, { method: "DELETE" });
    onClose();
  }

  async function toggleArchive() {
    const newArchived = !card?.archived;
    await fetch("/api/board/cards/archive", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cardId, archived: newArchived }),
    });
    fetchCard();
    fetchHistory();
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

  return (
    <div
      className={cn("fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8", dark && "scrollbar-touch")}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={cn(
        "rounded-2xl shadow-2xl w-full mx-4",
        dark ? "bg-slate-800 max-w-4xl" : "bg-white max-w-2xl",
      )}>
        {/* Header */}
        <div className={cn(
          "flex items-start justify-between border-b",
          dark ? "p-6 border-slate-700" : "p-4 border-slate-200",
        )}>
          {card.client?.logoUrl && (
            <img
              src={card.client.logoUrl}
              alt={card.client.name}
              className={cn(
                "object-contain rounded border flex-shrink-0",
                dark ? "h-12 w-12 border-slate-600 mr-4" : "h-8 w-8 border-slate-200 mr-3",
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
              <h2 className={cn("font-bold", dark ? "text-xl text-white" : "text-lg text-slate-900")}>{card.title}</h2>
            )}
            <div className={cn("flex items-center gap-2", dark ? "mt-2" : "mt-1")}>
              <span className={cn(dark ? "text-sm text-slate-400" : "text-xs text-slate-400")}>dans {card.column.name}</span>
              <span className={cn(
                "font-medium rounded border",
                dark ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]",
                dark ? priority.darkColor : priority.color,
              )}>
                {priority.label}
              </span>
            </div>
          </div>
          <div className={cn("flex items-center ml-3", dark ? "gap-2" : "gap-1")}>
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className={cn(
                    "rounded-lg",
                    dark ? "p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700" : "p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100",
                  )}
                  title="Modifier"
                >
                  <Pencil className={cn(dark ? "h-5 w-5" : "h-4 w-4")} />
                </button>
                <button
                  onClick={toggleArchive}
                  className={cn(
                    "rounded-lg",
                    dark
                      ? cn("p-3 min-h-[48px] min-w-[48px] flex items-center justify-center", card.archived ? "text-amber-400 hover:text-amber-300 hover:bg-amber-900/30" : "text-slate-400 hover:text-white hover:bg-slate-700")
                      : cn("p-2", card.archived ? "text-amber-500 hover:text-amber-600 hover:bg-amber-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"),
                  )}
                  title={card.archived ? "Désarchiver" : "Archiver"}
                >
                  {card.archived ? <ArchiveRestore className={cn(dark ? "h-5 w-5" : "h-4 w-4")} /> : <Archive className={cn(dark ? "h-5 w-5" : "h-4 w-4")} />}
                </button>
                <button
                  onClick={deleteCard}
                  className={cn(
                    "rounded-lg",
                    dark ? "p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-red-400 hover:bg-red-900/30" : "p-2 text-slate-400 hover:text-red-600 hover:bg-red-50",
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
                    "bg-primary-600 text-white rounded-lg hover:bg-primary-700",
                    dark ? "px-5 py-3 text-base font-medium min-h-[48px]" : "px-3 py-1.5 text-sm",
                  )}
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className={cn(
                    dark ? "px-5 py-3 text-base text-slate-400 hover:text-white min-h-[48px]" : "px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700",
                  )}
                >
                  Annuler
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className={cn(
                "rounded-lg",
                dark ? "p-3 min-h-[48px] min-w-[48px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700" : "p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
            >
              <X className={cn(dark ? "h-6 w-6" : "h-4 w-4")} />
            </button>
          </div>
        </div>

        <div className={cn(dark ? "p-6 space-y-6" : "p-4 space-y-5")}>
          {/* Meta info */}
          <div className={cn("grid grid-cols-2", dark ? "gap-5" : "gap-3")}>
            {/* Priority */}
            {editing && (
              <div>
                <label className={cn("font-medium mb-1.5 block", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>Priorité</label>
                <div className={cn("flex", dark ? "gap-2" : "gap-1")}>
                  {[1, 2, 3].map((p) => (
                    <button
                      key={p}
                      onClick={() => setEditPriority(p)}
                      className={cn(
                        "flex-1 rounded border font-medium",
                        dark ? "px-3 py-3 text-sm min-h-[48px]" : "px-2 py-1.5 text-xs",
                        editPriority === p
                          ? (dark ? PRIORITY_CONFIG[p].darkColor : PRIORITY_CONFIG[p].color)
                          : (dark ? "bg-slate-700 text-slate-400 border-slate-600" : "bg-white text-slate-400 border-slate-200"),
                      )}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assignees (multi-select) */}
            <div>
              <label className={cn("font-medium mb-1.5 flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                <Users className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                Assigné à
              </label>
              {(() => {
                const currentIds = editing
                  ? editAssigneeIds
                  : (card.assigneeIds ? JSON.parse(card.assigneeIds) : card.assigneeId ? [card.assigneeId] : []) as string[];

                const toggleAssignee = async (uid: string, checked: boolean) => {
                  const newIds = checked ? [...currentIds, uid] : currentIds.filter((id: string) => id !== uid);
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
                  <div className={cn(
                    "overflow-y-auto border rounded-lg",
                    dark ? "max-h-48 border-slate-600 p-2 space-y-1 scrollbar-touch" : "max-h-32 border-slate-200 p-1.5 space-y-0.5",
                  )}>
                    {users.map((u) => (
                      <label key={u.id} className={cn(
                        "flex items-center rounded cursor-pointer",
                        dark ? "gap-3 px-3 py-2.5 hover:bg-slate-700 min-h-[44px]" : "gap-2 px-1.5 py-1 hover:bg-slate-50",
                      )}>
                        <input
                          type="checkbox"
                          checked={currentIds.includes(u.id)}
                          onChange={(e) => toggleAssignee(u.id, e.target.checked)}
                          className={cn(
                            "rounded border-slate-300 text-primary-600 focus:ring-primary-500",
                            dark ? "h-5 w-5" : "h-3.5 w-3.5",
                          )}
                        />
                        <span className={cn(dark ? "text-base text-slate-200" : "text-sm text-slate-700")}>{u.name}</span>
                      </label>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Due date */}
            <div>
              <label className={cn("font-medium mb-1.5 flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                <Calendar className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                Date limite
              </label>
              {editing ? (
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className={cn(
                    "w-full border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500",
                    dark ? "px-4 py-3 text-base bg-slate-700 border-slate-600 text-white min-h-[48px]" : "px-2 py-1.5 text-sm border-slate-200",
                  )}
                />
              ) : (
                <p className={cn(
                  dark ? "text-base" : "text-sm",
                  card.dueDate && new Date(card.dueDate) < new Date() ? "text-red-400" : (dark ? "text-slate-200" : "text-slate-700"),
                )}>
                  {card.dueDate
                    ? new Date(card.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                    : "Aucune"}
                </p>
              )}
            </div>

            {/* Client */}
            <div>
              <label className={cn("font-medium mb-1.5 flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                <Users className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                Client
              </label>
              {editing ? (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setShowClientSearch(true);
                    }}
                    onFocus={() => setShowClientSearch(true)}
                    className={cn(
                      "w-full border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500",
                      dark ? "px-4 py-3 text-base bg-slate-700 border-slate-600 text-white placeholder-slate-500 min-h-[48px]" : "px-2 py-1.5 text-sm border-slate-200",
                    )}
                  />
                  {editClientId && (
                    <button
                      onClick={() => { setEditClientId(""); setClientSearch(""); setEditContactId(""); setClientContacts([]); }}
                      className={cn(
                        "absolute right-3 top-1/2 -translate-y-1/2",
                        dark ? "text-slate-400 hover:text-white p-1" : "text-slate-400 hover:text-slate-600",
                      )}
                    >
                      <X className={cn(dark ? "h-5 w-5" : "h-3.5 w-3.5")} />
                    </button>
                  )}
                  {showClientSearch && clients.length > 0 && (
                    <div className={cn(
                      "absolute z-10 top-full mt-1 w-full border rounded-lg shadow-lg max-h-48 overflow-y-auto",
                      dark ? "bg-slate-700 border-slate-600" : "bg-white border-slate-200",
                    )}>
                      {clients.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setEditClientId(c.id);
                            setClientSearch(c.name);
                            setShowClientSearch(false);
                            setEditContactId("");
                            fetchClientContacts(c.id);
                          }}
                          className={cn(
                            "w-full text-left",
                            dark ? "px-4 py-3 text-base text-slate-200 hover:bg-slate-600 min-h-[44px]" : "px-3 py-1.5 text-sm hover:bg-slate-50",
                          )}
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
                  className={cn(dark ? "text-base text-primary-400 hover:text-primary-300" : "text-sm text-primary-600 hover:text-primary-700 hover:underline")}
                >
                  {card.client.name}
                </Link>
              ) : (
                <p className={cn(dark ? "text-base text-slate-500" : "text-sm text-slate-400")}>Aucun</p>
              )}
            </div>

            {/* Contact / Personne */}
            <div>
              <label className={cn("font-medium mb-1.5 flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                <Users className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                Personne
              </label>
              {editing ? (
                editClientId && clientContacts.length > 0 ? (
                  <select
                    value={editContactId}
                    onChange={(e) => setEditContactId(e.target.value)}
                    className={cn(
                      "w-full border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500",
                      dark ? "px-4 py-3 text-base bg-slate-700 border-slate-600 text-white min-h-[48px]" : "px-2 py-1.5 text-sm border-slate-200",
                    )}
                  >
                    <option value="">Aucune</option>
                    {clientContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Sans nom"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className={cn("italic", dark ? "text-base text-slate-500" : "text-sm text-slate-400")}>
                    {editClientId ? "Aucun contact" : "Sélectionnez un client"}
                  </p>
                )
              ) : card.contact ? (
                <p className={cn(dark ? "text-base text-slate-200" : "text-sm text-slate-700")}>
                  {[card.contact.firstName, card.contact.lastName].filter(Boolean).join(" ") || "Sans nom"}
                </p>
              ) : (
                <p className={cn(dark ? "text-base text-slate-500" : "text-sm text-slate-400")}>Aucune</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={cn("font-medium mb-1.5 block", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>Description</label>
            {editing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Ajouter une description..."
                rows={dark ? 4 : 3}
                className={cn(
                  "w-full border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none",
                  dark ? "px-4 py-3 text-base bg-slate-700 border-slate-600 text-white placeholder-slate-500" : "px-3 py-2 text-sm border-slate-200",
                )}
              />
            ) : (
              <p className={cn("whitespace-pre-wrap", dark ? "text-base text-slate-200" : "text-sm text-slate-700")}>
                {card.description || <span className={cn("italic", dark ? "text-slate-500" : "text-slate-400")}>Aucune description</span>}
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className={cn("font-medium mb-2 flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
              <Tag className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
              Tags
            </label>
            <div className={cn("flex flex-wrap mb-2", dark ? "gap-2" : "gap-1.5")}>
              {(editing ? allTags.filter((t) => selectedTagIds.includes(t.id)) : card.tags.map((t) => t.tag)).map((tag) => (
                <span
                  key={tag.id}
                  className={cn(
                    "inline-flex items-center font-medium rounded",
                    dark ? "gap-2 px-3 py-1.5 text-sm" : "gap-1 px-2 py-0.5 text-xs",
                  )}
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.name}
                  {editing && (
                    <button
                      onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))}
                      className={cn("hover:opacity-70", dark ? "p-1" : "")}
                    >
                      <X className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                    </button>
                  )}
                </span>
              ))}
              {editing && (
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className={cn(
                    "inline-flex items-center border border-dashed rounded",
                    dark ? "gap-2 px-3 py-1.5 text-sm text-slate-400 border-slate-600 hover:border-slate-400 min-h-[40px]" : "gap-1 px-2 py-0.5 text-xs text-slate-500 border-slate-300 hover:border-slate-400",
                  )}
                >
                  <Plus className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                  Tag
                </button>
              )}
            </div>
            {editing && showTagPicker && (
              <div className={cn(
                "border rounded-lg space-y-3",
                dark ? "bg-slate-700/50 border-slate-600 p-4" : "bg-slate-50 border-slate-200 p-3",
              )}>
                <div className={cn("flex flex-wrap", dark ? "gap-2" : "gap-1")}>
                  {allTags
                    .filter((t) => !selectedTagIds.includes(t.id))
                    .map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagIds((prev) => [...prev, tag.id])}
                        className={cn(
                          "rounded border",
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
                      "flex-1 border rounded focus:outline-none focus:ring-1 focus:ring-primary-500",
                      dark ? "px-4 py-2.5 text-sm bg-slate-700 border-slate-600 text-white placeholder-slate-500 min-h-[44px]" : "px-2 py-1 text-xs border-slate-200",
                    )}
                  />
                  <button onClick={createTag} className={cn(
                    "bg-primary-600 text-white rounded hover:bg-primary-700 font-medium",
                    dark ? "px-4 py-2.5 text-sm min-h-[44px]" : "px-2 py-1 text-xs",
                  )}>
                    Créer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <label className={cn("font-medium mb-2 flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
              <LinkIcon className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
              Liens
            </label>
            <div className={cn("mb-2", dark ? "space-y-2" : "space-y-1")}>
              {(editing ? editLinks : links).map((link, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "hover:underline truncate flex items-center gap-1.5",
                      dark ? "text-base text-primary-400 hover:text-primary-300" : "text-sm text-primary-600 hover:text-primary-700",
                    )}
                  >
                    <ExternalLink className={cn("flex-shrink-0", dark ? "h-4 w-4" : "h-3 w-3")} />
                    {link}
                  </a>
                  {editing && (
                    <button
                      onClick={() => removeLink(i)}
                      className={cn(
                        dark ? "text-slate-500 hover:text-red-400 p-2 min-h-[44px]" : "text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <X className={cn(dark ? "h-5 w-5" : "h-3.5 w-3.5")} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editing && (
              <div className={cn("flex", dark ? "gap-2" : "gap-1.5")}>
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
                  "border rounded-lg font-medium",
                  dark ? "px-5 py-3 text-base text-primary-400 border-primary-700 hover:bg-primary-900/30 min-h-[48px]" : "px-3 py-1.5 text-sm text-primary-600 border-primary-200 hover:bg-primary-50",
                )}>
                  Ajouter
                </button>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className={cn("flex items-center justify-between", dark ? "mb-3" : "mb-2")}>
              <label className={cn("font-medium flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                <Paperclip className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                Pièces jointes ({card.attachments.length})
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className={cn(
                  "flex items-center gap-1.5 text-primary-600 border border-primary-200 rounded disabled:opacity-50",
                  dark ? "px-4 py-2.5 text-sm hover:bg-primary-900/30 border-primary-700 text-primary-400 min-h-[44px]" : "px-2 py-1 text-xs hover:bg-primary-50",
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
            <div className={cn(dark ? "space-y-3" : "space-y-2")}>
              {card.attachments.map((att) => (
                <div key={att.id} className={cn(
                  "flex items-center rounded-lg group",
                  dark ? "gap-4 p-3 bg-slate-700/50" : "gap-3 p-2 bg-slate-50",
                )}>
                  {isImageType(att.fileType) ? (
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className={cn(
                        "object-cover rounded border",
                        dark ? "w-16 h-16 border-slate-600" : "w-12 h-12 border-slate-200",
                      )}
                    />
                  ) : (
                    <div className={cn(
                      "flex items-center justify-center rounded",
                      dark ? "w-16 h-16 bg-slate-600" : "w-12 h-12 bg-slate-200",
                    )}>
                      <FileText className={cn(dark ? "h-7 w-7 text-slate-400" : "h-5 w-5 text-slate-500")} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "hover:text-primary-600 truncate block",
                        dark ? "text-base text-slate-200" : "text-sm text-slate-700",
                      )}
                    >
                      {att.fileName}
                    </a>
                    <p className={cn(dark ? "text-sm text-slate-500" : "text-xs text-slate-400")}>{formatFileSize(att.fileSize)}</p>
                  </div>
                  <div className={cn("flex items-center", dark ? "gap-2" : "gap-1 opacity-0 group-hover:opacity-100")}>
                    <a
                      href={att.fileUrl}
                      download
                      className={cn(
                        "rounded",
                        dark ? "p-3 text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center" : "p-1.5 text-slate-400 hover:text-slate-600",
                      )}
                    >
                      <Download className={cn(dark ? "h-5 w-5" : "h-3.5 w-3.5")} />
                    </a>
                    <button
                      onClick={() => deleteAttachment(att.id)}
                      className={cn(
                        "rounded",
                        dark ? "p-3 text-slate-400 hover:text-red-400 min-h-[44px] min-w-[44px] flex items-center justify-center" : "p-1.5 text-slate-400 hover:text-red-600",
                      )}
                    >
                      <Trash2 className={cn(dark ? "h-5 w-5" : "h-3.5 w-3.5")} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className={cn("font-medium mb-2 flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
              <MessageSquare className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
              Commentaires ({card.comments.length})
            </label>

            {/* Add comment */}
            <div className={cn("flex mb-3", dark ? "gap-3" : "gap-2")}>
              <MentionInput
                value={commentText}
                onChange={setCommentText}
                onSubmit={addComment}
                placeholder="Écrire un commentaire... (@mention)"
                rows={dark ? 3 : 2}
                users={users}
                className={cn(
                  "flex-1",
                  dark ? "px-4 py-3 text-base border-slate-600 bg-slate-700 text-white focus:ring-primary-500" : "px-3 py-2 text-sm border-slate-200 focus:ring-primary-500",
                )}
              />
              <button
                onClick={addComment}
                disabled={!commentText.trim() || sendingComment}
                className={cn(
                  "self-end bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50",
                  dark ? "px-5 py-3 min-h-[48px]" : "px-3 py-2 text-sm",
                )}
              >
                <Send className={cn(dark ? "h-5 w-5" : "h-4 w-4")} />
              </button>
            </div>

            {/* Comment list */}
            <div className={cn(dark ? "space-y-4" : "space-y-3")}>
              {card.comments.map((comment) => (
                <div key={comment.id} className="group">
                  <div className={cn("flex items-center mb-1", dark ? "gap-3" : "gap-2")}>
                    <div className={cn(
                      "rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700",
                      dark ? "w-8 h-8 text-sm" : "w-6 h-6 text-[10px]",
                    )}>
                      {comment.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className={cn("font-medium", dark ? "text-base text-slate-200" : "text-sm text-slate-700")}>{comment.userName}</span>
                    <span className={cn(dark ? "text-sm text-slate-500" : "text-xs text-slate-400")}>{formatRelativeTime(comment.createdAt)}</span>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className={cn(
                        "ml-auto",
                        dark ? "text-slate-600 hover:text-red-400 p-2 min-h-[44px]" : "text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100",
                      )}
                    >
                      <Trash2 className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                    </button>
                  </div>
                  <p className={cn("whitespace-pre-wrap", dark ? "text-base text-slate-300 ml-11" : "text-sm text-slate-600 ml-8")}>
                    {comment.content.split(/(@[\w\s]+?(?:​|$))/).map((part, i) =>
                      part.startsWith("@") ? (
                        <span key={i} className="bg-primary-100 text-primary-700 rounded px-0.5 font-medium">{part.replace("​", "")}</span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <label className={cn("font-medium mb-2 flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                <History className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
                Historique ({history.length})
              </label>
              <div className={cn("overflow-y-auto", dark ? "max-h-64 space-y-2 scrollbar-touch" : "max-h-48 space-y-1.5")}>
                {history.map((entry) => (
                  <div key={entry.id} className={cn("flex items-start gap-2", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                    <div className={cn("rounded-full flex-shrink-0", dark ? "w-2 h-2 bg-slate-600 mt-2" : "w-1.5 h-1.5 bg-slate-300 mt-1.5")} />
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
                      {entry.action === "COMMENT" && (
                        <>a ajouté un commentaire</>
                      )}
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
            </div>
          )}

          {/* Footer info */}
          <div className={cn(
            "flex items-center gap-4 pt-3 border-t",
            dark ? "text-sm text-slate-500 border-slate-700" : "text-xs text-slate-400 border-slate-100",
          )}>
            <span className={cn("flex items-center gap-1.5")}>
              <Clock className={cn(dark ? "h-4 w-4" : "h-3 w-3")} />
              Créée {formatRelativeTime(card.createdAt)}
            </span>
            {creator && (
              <span>par {creator.name}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
