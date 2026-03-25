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
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  client: { id: string; name: string } | null;
  contactId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null } | null;
  assigneeId: string | null;
  createdById: string | null;
  dueDate: string | null;
  links: string | null;
  tags: CardTag[];
  comments: CardComment[];
  attachments: CardAttachment[];
  createdAt: string;
  updatedAt: string;
}

interface Props {
  cardId: string;
  users: { id: string; name: string }[];
  onClose: () => void;
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: "Urgente", color: "bg-red-50 text-red-700 border-red-200" },
  2: { label: "Normale", color: "bg-orange-50 text-orange-700 border-orange-200" },
  3: { label: "Basse", color: "bg-slate-50 text-slate-600 border-slate-200" },
};

export default function CardDetailModal({ cardId, users, onClose }: Props) {
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState(3);
  const [editClientId, setEditClientId] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
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
        setEditAssigneeId(data.assigneeId || "");
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
  }, [fetchCard, fetchTags]);

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
        assigneeId: editAssigneeId || null,
        dueDate: editDueDate || null,
        links: editLinks.length > 0 ? editLinks : null,
        tagIds: selectedTagIds,
      }),
    });
    setEditing(false);
    fetchCard();
  }

  async function deleteCard() {
    if (!confirm("Supprimer cette carte ?")) return;
    await fetch(`/api/board/cards?id=${cardId}`, { method: "DELETE" });
    onClose();
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!card) return null;

  const priority = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG[3];
  const assignee = users.find((u) => u.id === card.assigneeId);
  const creator = users.find((u) => u.id === card.createdById);
  const links: string[] = card.links ? JSON.parse(card.links) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full text-lg font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            ) : (
              <h2 className="text-lg font-bold text-slate-900">{card.title}</h2>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">dans {card.column.name}</span>
              <span className={cn("px-1.5 py-0.5 text-[10px] font-medium rounded border", priority.color)}>
                {priority.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-3">
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={deleteCard}
                  className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={saveCard}
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Enregistrer
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700"
                >
                  Annuler
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-5">
          {/* Meta info */}
          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            {editing && (
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">Priorité</label>
                <div className="flex gap-1">
                  {[1, 2, 3].map((p) => (
                    <button
                      key={p}
                      onClick={() => setEditPriority(p)}
                      className={cn(
                        "flex-1 px-2 py-1.5 text-xs rounded border",
                        editPriority === p
                          ? PRIORITY_CONFIG[p].color
                          : "bg-white text-slate-400 border-slate-200"
                      )}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Assignee */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Assigné à
              </label>
              {editing ? (
                <select
                  value={editAssigneeId}
                  onChange={(e) => setEditAssigneeId(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Non assigné</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-700">{assignee?.name || "Non assigné"}</p>
              )}
            </div>

            {/* Due date */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Date limite
              </label>
              {editing ? (
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              ) : (
                <p className={cn("text-sm", card.dueDate && new Date(card.dueDate) < new Date() ? "text-red-600" : "text-slate-700")}>
                  {card.dueDate
                    ? new Date(card.dueDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                    : "Aucune"}
                </p>
              )}
            </div>

            {/* Client */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" />
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
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {editClientId && (
                    <button
                      onClick={() => { setEditClientId(""); setClientSearch(""); setEditContactId(""); setClientContacts([]); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {showClientSearch && clients.length > 0 && (
                    <div className="absolute z-10 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
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
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50"
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
                  className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
                >
                  {card.client.name}
                </Link>
              ) : (
                <p className="text-sm text-slate-400">Aucun</p>
              )}
            </div>

            {/* Contact / Personne */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                <Users className="h-3 w-3" />
                Personne
              </label>
              {editing ? (
                editClientId && clientContacts.length > 0 ? (
                  <select
                    value={editContactId}
                    onChange={(e) => setEditContactId(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Aucune</option>
                    {clientContacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Sans nom"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-400 italic">
                    {editClientId ? "Aucun contact" : "Sélectionnez un client"}
                  </p>
                )
              ) : card.contact ? (
                <p className="text-sm text-slate-700">
                  {[card.contact.firstName, card.contact.lastName].filter(Boolean).join(" ") || "Sans nom"}
                </p>
              ) : (
                <p className="text-sm text-slate-400">Aucune</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Description</label>
            {editing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Ajouter une description..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {card.description || <span className="text-slate-400 italic">Aucune description</span>}
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Tags
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(editing ? allTags.filter((t) => selectedTagIds.includes(t.id)) : card.tags.map((t) => t.tag)).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded"
                  style={{ backgroundColor: tag.color + "20", color: tag.color }}
                >
                  {tag.name}
                  {editing && (
                    <button
                      onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tag.id))}
                      className="hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {editing && (
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs text-slate-500 border border-dashed border-slate-300 rounded hover:border-slate-400"
                >
                  <Plus className="h-3 w-3" />
                  Tag
                </button>
              )}
            </div>
            {editing && showTagPicker && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {allTags
                    .filter((t) => !selectedTagIds.includes(t.id))
                    .map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagIds((prev) => [...prev, tag.id])}
                        className="px-2 py-0.5 text-xs rounded border border-slate-200 hover:border-slate-400"
                        style={{ color: tag.color }}
                      >
                        + {tag.name}
                      </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="w-7 h-7 rounded cursor-pointer border-0"
                  />
                  <input
                    type="text"
                    placeholder="Nouveau tag..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createTag()}
                    className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <button onClick={createTag} className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700">
                    Créer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Links */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />
              Liens
            </label>
            <div className="space-y-1 mb-2">
              {(editing ? editLinks : links).map((link, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:text-primary-700 hover:underline truncate flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    {link}
                  </a>
                  {editing && (
                    <button
                      onClick={() => removeLink(i)}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {editing && (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="https://..."
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLink()}
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button onClick={addLink} className="px-3 py-1.5 text-sm text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50">
                  Ajouter
                </button>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                Pièces jointes ({card.attachments.length})
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 border border-primary-200 rounded hover:bg-primary-50 disabled:opacity-50"
              >
                <Upload className="h-3 w-3" />
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
            <div className="space-y-2">
              {card.attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg group">
                  {isImageType(att.fileType) ? (
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="w-12 h-12 object-cover rounded border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-slate-200 rounded">
                      <FileText className="h-5 w-5 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate-700 hover:text-primary-600 truncate block"
                    >
                      {att.fileName}
                    </a>
                    <p className="text-xs text-slate-400">{formatFileSize(att.fileSize)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <a
                      href={att.fileUrl}
                      download
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    <button
                      onClick={() => deleteAttachment(att.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Commentaires ({card.comments.length})
            </label>

            {/* Add comment */}
            <div className="flex gap-2 mb-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Écrire un commentaire..."
                rows={2}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addComment();
                }}
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <button
                onClick={addComment}
                disabled={!commentText.trim() || sendingComment}
                className="self-end px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            {/* Comment list */}
            <div className="space-y-3">
              {card.comments.map((comment) => (
                <div key={comment.id} className="group">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-bold text-primary-700">
                      {comment.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{comment.userName}</span>
                    <span className="text-xs text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="ml-auto text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-600 ml-8 whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer info */}
          <div className="flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
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
