"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, MoreHorizontal, Pencil, Trash2, X, Check } from "lucide-react";
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

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  async function addCard() {
    if (!newCardTitle.trim()) return;
    await fetch("/api/board/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        columnId: column.id,
        title: newCardTitle.trim(),
        priority: newCardPriority,
      }),
    });
    setNewCardTitle("");
    setNewCardPriority(3);
    setShowAddCard(false);
    onCardCreated();
  }

  function saveColumnEdit() {
    onUpdateColumn(column.id, { name: editName.trim(), color: editColor });
    setEditing(false);
  }

  return (
    <div
      className={cn(
        "flex-shrink-0 w-72 bg-slate-100 rounded-xl flex flex-col max-h-[calc(100vh-200px)]",
        isOver && "ring-2 ring-primary-400 ring-offset-2"
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
      <div ref={setNodeRef} className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
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
                onClick={() => { setShowAddCard(false); setNewCardTitle(""); }}
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
