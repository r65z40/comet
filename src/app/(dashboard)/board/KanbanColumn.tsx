"use client";

import { useState, useEffect, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, MoreHorizontal, Pencil, Trash2, X, Check, Search, Building2, User, UserCheck, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import KanbanCard from "./KanbanCard";

interface CardTag {
  id: string;
  tag: { id: string; name: string; color: string };
}

interface BoardCard {
  id: string;
  columnId: string;
  title: string;
  description: string | null;
  priority: number;
  position: number;
  clientId: string | null;
  client: { id: string; name: string } | null;
  contactId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null } | null;
  assigneeId: string | null;
  dueDate: string | null;
  links: string | null;
  tags: CardTag[];
  _count: { comments: number; attachments: number };
  createdAt: string;
}

interface BoardColumn {
  id: string;
  name: string;
  color: string;
  position: number;
  cards: BoardCard[];
}

interface Props {
  column: BoardColumn;
  users: { id: string; name: string }[];
  onDeleteColumn: (id: string) => void;
  onUpdateColumn: (id: string, data: { name?: string; color?: string }) => void;
  onCardClick: (cardId: string) => void;
  onCardCreated: () => void;
}

export default function KanbanColumn({
  column,
  users,
  onDeleteColumn,
  onUpdateColumn,
  onCardClick,
  onCardCreated,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);
  const [editColor, setEditColor] = useState(column.color);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardPriority, setNewCardPriority] = useState(3);

  // Client search for new card
  const [newCardClientId, setNewCardClientId] = useState("");
  const [newCardClientName, setNewCardClientName] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<{ id: string; name: string }[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Contact search for new card
  const [newCardContactId, setNewCardContactId] = useState("");
  const [newCardContactName, setNewCardContactName] = useState("");
  const [contacts, setContacts] = useState<{ id: string; firstName: string | null; lastName: string | null }[]>([]);

  // Assignees for new card (multi-select)
  const [newCardAssigneeIds, setNewCardAssigneeIds] = useState<string[]>([]);

  // Column is both a sortable item (for reordering) and a droppable container (for cards)
  const {
    attributes: sortableAttributes,
    listeners: sortableListeners,
    setNodeRef: setSortableNodeRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({ id: column.id, data: { type: "column" } });

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({ id: `card-drop-${column.id}` });

  const columnStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const searchClients = useCallback(async (q: string) => {
    if (q.length < 2) { setClientResults([]); return; }
    try {
      const res = await fetch(`/api/clients?search=${encodeURIComponent(q)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setClientResults(data.clients.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      }
    } catch { /* ignore */ }
  }, []);

  const fetchContacts = useCallback(async (clientId: string) => {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (clientSearch.length >= 2) {
      const timeout = setTimeout(() => searchClients(clientSearch), 300);
      return () => clearTimeout(timeout);
    } else {
      setClientResults([]);
    }
  }, [clientSearch, searchClients]);

  useEffect(() => {
    if (newCardClientId) {
      fetchContacts(newCardClientId);
    } else {
      setContacts([]);
      setNewCardContactId("");
      setNewCardContactName("");
    }
  }, [newCardClientId, fetchContacts]);

  async function addCard() {
    if (!newCardTitle.trim()) return;
    await fetch("/api/board/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columnId: column.id,
        title: newCardTitle.trim(),
        priority: newCardPriority,
        clientId: newCardClientId || null,
        contactId: newCardContactId || null,
        assigneeIds: newCardAssigneeIds.length > 0 ? newCardAssigneeIds : undefined,
        assigneeId: newCardAssigneeIds[0] || null,
      }),
    });
    setNewCardTitle("");
    setNewCardPriority(3);
    setNewCardClientId("");
    setNewCardClientName("");
    setNewCardContactId("");
    setNewCardContactName("");
    setNewCardAssigneeIds([]);
    setClientSearch("");
    setShowAddCard(false);
    onCardCreated();
  }

  function saveColumnEdit() {
    onUpdateColumn(column.id, { name: editName.trim(), color: editColor });
    setEditing(false);
  }

  function selectClient(client: { id: string; name: string }) {
    setNewCardClientId(client.id);
    setNewCardClientName(client.name);
    setClientSearch(client.name);
    setShowClientDropdown(false);
  }

  function clearClient() {
    setNewCardClientId("");
    setNewCardClientName("");
    setClientSearch("");
    setNewCardContactId("");
    setNewCardContactName("");
  }

  return (
    <div
      ref={setSortableNodeRef}
      style={columnStyle}
      className={cn(
        "flex-shrink-0 w-72 bg-slate-100 rounded-xl flex flex-col max-h-[calc(100vh-200px)]",
        isOver && "ring-2 ring-primary-400 ring-offset-2",
        isColumnDragging && "opacity-50 shadow-lg"
      )}
    >
      {/* Column Header */}
      <div className="p-3 flex items-center justify-between">
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="color"
              value={editColor}
              onChange={(e) => setEditColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0"
            />
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveColumnEdit()}
              className="flex-1 px-2 py-1 text-sm font-medium border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
            <button onClick={saveColumnEdit} className="text-emerald-600 hover:text-emerald-700">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              {/* Column drag handle */}
              <button
                {...sortableAttributes}
                {...sortableListeners}
                className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing transition-colors"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: column.color }}
              />
              <h3 className="text-sm font-semibold text-slate-700">{column.name}</h3>
              <span className="text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
                {column.cards.length}
              </span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 w-36">
                  <button
                    onClick={() => {
                      setEditing(true);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                  <button
                    onClick={() => {
                      onDeleteColumn(column.id);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Cards */}
      <div
        ref={setDroppableNodeRef}
        className={cn(
          "flex-1 overflow-y-auto px-3 pb-3 space-y-2 min-h-[80px] transition-colors rounded-lg",
          isOver && "bg-primary-50/60"
        )}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onClick={() => onCardClick(card.id)}
            />
          ))}
        </SortableContext>

        {/* Empty state placeholder — serves as visual drop target */}
        {column.cards.length === 0 && !showAddCard && (
          <div
            className={cn(
              "flex items-center justify-center border-2 border-dashed rounded-lg py-6 text-xs text-slate-400 transition-colors",
              isOver ? "border-primary-400 text-primary-500 bg-primary-50/40" : "border-slate-300"
            )}
          >
            Déposez une carte ici
          </div>
        )}

        {/* Add card form */}
        {showAddCard ? (
          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
            <input
              type="text"
              placeholder="Titre de la carte..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCard()}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
            />

            {/* Client selection */}
            <div className="relative">
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3 text-slate-400" />
                <span className="text-[10px] text-slate-500 font-medium">Client</span>
              </div>
              {newCardClientId ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-slate-700 truncate flex-1">{newCardClientName}</span>
                  <button onClick={clearClient} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="relative mt-0.5">
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  {showClientDropdown && clientResults.length > 0 && (
                    <div className="absolute z-20 top-full mt-0.5 w-full bg-white border border-slate-200 rounded shadow-lg max-h-28 overflow-y-auto">
                      {clientResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => selectClient(c)}
                          className="w-full text-left px-2 py-1 text-xs hover:bg-slate-50 truncate"
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Contact selection (only when client is selected) */}
            {newCardClientId && contacts.length > 0 && (
              <div>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500 font-medium">Personne</span>
                </div>
                <select
                  value={newCardContactId}
                  onChange={(e) => {
                    setNewCardContactId(e.target.value);
                    const c = contacts.find(ct => ct.id === e.target.value);
                    setNewCardContactName(c ? [c.firstName, c.lastName].filter(Boolean).join(" ") : "");
                  }}
                  className="w-full mt-0.5 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">Sélectionner...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") || "Sans nom"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Assignee selection (multi) */}
            <div>
              <div className="flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-slate-400" />
                <span className="text-[10px] text-slate-500 font-medium">Assigné à</span>
              </div>
              <div className="mt-0.5 max-h-24 overflow-y-auto border border-slate-200 rounded p-1 space-y-0.5">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCardAssigneeIds.includes(u.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewCardAssigneeIds([...newCardAssigneeIds, u.id]);
                        } else {
                          setNewCardAssigneeIds(newCardAssigneeIds.filter(id => id !== u.id));
                        }
                      }}
                      className="h-3 w-3 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-xs text-slate-700">{u.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Priorité :</span>
              {[
                { value: 1, label: "Urgente", color: "bg-red-100 text-red-700 border-red-200" },
                { value: 2, label: "Normale", color: "bg-orange-100 text-orange-700 border-orange-200" },
                { value: 3, label: "Basse", color: "bg-slate-100 text-slate-600 border-slate-200" },
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setNewCardPriority(p.value)}
                  className={cn(
                    "px-2 py-0.5 text-xs rounded border",
                    newCardPriority === p.value ? p.color : "bg-white text-slate-400 border-slate-200"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5">
              <button
                onClick={addCard}
                className="px-3 py-1.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Ajouter
              </button>
              <button
                onClick={() => { setShowAddCard(false); setNewCardTitle(""); clearClient(); setNewCardAssigneeIds([]); }}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddCard(true)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            Ajouter une carte
          </button>
        )}
      </div>
    </div>
  );
}
