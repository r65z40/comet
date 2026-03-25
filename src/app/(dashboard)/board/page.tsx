"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ClipboardList,
  Plus,
  Filter,
  Search,
  X,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  Type,
  Heading1,
  Heading2,
  Save,
  CheckCircle,
  StickyNote,
  Strikethrough,
  Highlighter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import CardDetailModal from "./CardDetailModal";

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
  client: { id: string; name: string; logoUrl?: string | null } | null;
  contactId: string | null;
  contact: { id: string; firstName: string | null; lastName: string | null } | null;
  assigneeId: string | null;
  assigneeName?: string;
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

export default function BoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    searchParams.get("card")
  );
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("#3b82f6");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  // Notes state
  const [noteContent, setNoteContent] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteLastUpdatedBy, setNoteLastUpdatedBy] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initDefaultColumnsCalledRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/board/columns");
      if (res.ok) {
        const data = await res.json();
        setColumns(data);
      }
    } catch {
      console.error("Erreur chargement tableau");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/board/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchNote = useCallback(async () => {
    try {
      const res = await fetch("/api/board/notes");
      if (res.ok) {
        const data = await res.json();
        setNoteContent(data.content || "");
        setNoteLastUpdatedBy(data.updatedBy || null);
        if (editorRef.current && data.content) {
          editorRef.current.innerHTML = data.content;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Load data once on mount
  useEffect(() => {
    fetchBoard();
    fetchUsers();
    fetchNote();
  }, [fetchBoard, fetchUsers, fetchNote]);

  // Initialize default columns if board is empty (with guard against double call)
  useEffect(() => {
    if (!loading && columns.length === 0 && !initDefaultColumnsCalledRef.current) {
      initDefaultColumnsCalledRef.current = true;
      initDefaultColumns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, columns.length]);

  // Enrich columns with assignee names
  const enrichedColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      cards: col.cards.map((card) => ({
        ...card,
        assigneeName: card.assigneeId
          ? users.find((u) => u.id === card.assigneeId)?.name || undefined
          : undefined,
      })),
    }));
  }, [columns, users]);

  async function initDefaultColumns() {
    const defaults = [
      { name: "À faire", color: "#6b7280" },
      { name: "En cours", color: "#3b82f6" },
      { name: "Attente retour client", color: "#f59e0b" },
      { name: "Terminée", color: "#10b981" },
    ];
    for (const col of defaults) {
      await fetch("/api/board/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(col),
      });
    }
    fetchBoard();
  }

  async function addColumn() {
    if (!newColumnName.trim()) return;
    await fetch("/api/board/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newColumnName.trim(), color: newColumnColor }),
    });
    setNewColumnName("");
    setNewColumnColor("#3b82f6");
    setShowAddColumn(false);
    fetchBoard();
  }

  async function deleteColumn(id: string) {
    if (!confirm("Supprimer cette colonne et toutes ses cartes ?")) return;
    await fetch(`/api/board/columns?id=${id}`, { method: "DELETE" });
    fetchBoard();
  }

  async function updateColumn(id: string, data: { name?: string; color?: string }) {
    await fetch("/api/board/columns", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    fetchBoard();
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const card = columns
      .flatMap((col) => col.cards)
      .find((c) => c.id === active.id);
    setActiveCard(card || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    // Find source card
    const sourceColumn = columns.find((col) =>
      col.cards.some((c) => c.id === activeCardId)
    );
    if (!sourceColumn) return;

    // Determine target column and position
    let targetColumnId: string;
    let targetPosition: number;

    // Check if dropped on a column header
    const targetColumn = columns.find((col) => col.id === overId);
    if (targetColumn) {
      targetColumnId = targetColumn.id;
      targetPosition = targetColumn.cards.length;
    } else {
      // Dropped on a card
      const overColumn = columns.find((col) =>
        col.cards.some((c) => c.id === overId)
      );
      if (!overColumn) return;
      targetColumnId = overColumn.id;
      const overCard = overColumn.cards.find((c) => c.id === overId);
      targetPosition = overCard?.position ?? 0;
    }

    if (activeCardId === overId) return;

    // Optimistic update
    setColumns((prev) => {
      const next = prev.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.id !== activeCardId),
      }));
      const card = sourceColumn.cards.find((c) => c.id === activeCardId);
      if (card) {
        const targetCol = next.find((c) => c.id === targetColumnId);
        if (targetCol) {
          const updatedCard = { ...card, columnId: targetColumnId };
          targetCol.cards.splice(targetPosition, 0, updatedCard);
          targetCol.cards = targetCol.cards.map((c, i) => ({ ...c, position: i }));
        }
      }
      return next;
    });

    await fetch("/api/board/cards/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId: activeCardId,
        targetColumnId,
        targetPosition,
      }),
    });

    fetchBoard();
  }

  function handleDragOver(event: DragOverEvent) {
    // Allow dropping on columns
  }

  function openCard(cardId: string) {
    setSelectedCardId(cardId);
    router.replace(`/board?card=${cardId}`, { scroll: false });
  }

  function closeCard() {
    setSelectedCardId(null);
    router.replace("/board", { scroll: false });
    fetchBoard();
  }

  // Notes functions
  function execCommand(command: string, value?: string) {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleNoteChange();
  }

  function handleNoteChange() {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setNoteContent(html);
    setNoteSaved(false);

    // Auto-save after 1.5s of inactivity
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveNote(html), 1500);
  }

  async function saveNote(content?: string) {
    const htmlContent = content ?? editorRef.current?.innerHTML ?? noteContent;
    setNoteSaving(true);
    try {
      const res = await fetch("/api/board/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: htmlContent }),
      });
      if (res.ok) {
        setNoteSaved(true);
        setTimeout(() => setNoteSaved(false), 2000);
      }
    } catch {
      // ignore
    } finally {
      setNoteSaving(false);
    }
  }

  function insertLink() {
    const url = prompt("URL du lien :");
    if (url) {
      execCommand("createLink", url);
    }
  }

  // Filter cards
  const filteredColumns = enrichedColumns.map((col) => ({
    ...col,
    cards: col.cards.filter((card) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = card.title.toLowerCase().includes(q);
        const matchClient = card.client?.name.toLowerCase().includes(q);
        const matchDesc = card.description?.toLowerCase().includes(q);
        const matchTags = card.tags.some((t) =>
          t.tag.name.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchClient && !matchDesc && !matchTags) return false;
      }
      if (filterPriority !== null && card.priority !== filterPriority) return false;
      return true;
    }),
  }));

  const totalCards = columns.reduce((sum, col) => sum + col.cards.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <ClipboardList className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Board</h1>
            <p className="text-sm text-slate-500">{totalCards} carte{totalCards > 1 ? "s" : ""}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors",
                filterPriority !== null
                  ? "border-primary-300 bg-primary-50 text-primary-700"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Filter className="h-4 w-4" />
              Filtres
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showFilters && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50 w-48">
                <p className="text-xs font-medium text-slate-500 mb-2">Priorité</p>
                {[
                  { value: null, label: "Toutes" },
                  { value: 1, label: "Urgente", color: "text-red-600" },
                  { value: 2, label: "Normale", color: "text-orange-600" },
                  { value: 3, label: "Basse", color: "text-slate-600" },
                ].map((opt) => (
                  <button
                    key={opt.value ?? "all"}
                    onClick={() => {
                      setFilterPriority(opt.value);
                      setShowFilters(false);
                    }}
                    className={cn(
                      "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-slate-50",
                      filterPriority === opt.value && "bg-primary-50 text-primary-700"
                    )}
                  >
                    <span className={opt.color}>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Add column */}
          <button
            onClick={() => setShowAddColumn(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Colonne
          </button>
        </div>
      </div>

      {/* Add column form */}
      {showAddColumn && (
        <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200">
          <input
            type="text"
            placeholder="Nom de la colonne"
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addColumn()}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          <input
            type="color"
            value={newColumnColor}
            onChange={(e) => setNewColumnColor(e.target.value)}
            className="w-10 h-10 rounded border border-slate-200 cursor-pointer"
          />
          <button
            onClick={addColumn}
            className="px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Ajouter
          </button>
          <button
            onClick={() => setShowAddColumn(false)}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Kanban Board - Full width */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 w-full" style={{ minHeight: "60vh" }}>
          {filteredColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              users={users}
              onDeleteColumn={deleteColumn}
              onUpdateColumn={updateColumn}
              onCardClick={openCard}
              onCardCreated={fetchBoard}
            />
          ))}
        </div>

        <DragOverlay>
          {activeCard ? (
            <div className="rotate-3 opacity-90">
              <KanbanCard card={activeCard} onClick={() => {}} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Notes Section - Full width */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full">
        {/* Notes Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-semibold text-slate-800">Notes & Informations</h2>
          </div>
          <div className="flex items-center gap-2">
            {noteLastUpdatedBy && (
              <span className="text-xs text-slate-400">
                Modifié par {noteLastUpdatedBy}
              </span>
            )}
            {noteSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Enregistré
              </span>
            )}
            <button
              onClick={() => saveNote()}
              disabled={noteSaving}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors",
                noteSaving
                  ? "bg-slate-100 text-slate-400"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              )}
            >
              <Save className="h-3.5 w-3.5" />
              {noteSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex items-center gap-0.5 p-2 border-b border-slate-100 flex-wrap">
          <button
            onClick={() => execCommand("formatBlock", "h1")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Titre 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("formatBlock", "h2")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Titre 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("formatBlock", "p")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Paragraphe"
          >
            <Type className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            onClick={() => execCommand("bold")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Gras (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("italic")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Italique (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("underline")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Souligné (Ctrl+U)"
          >
            <Underline className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("strikethrough")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Barré"
          >
            <Strikethrough className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("hiliteColor", "#fef08a")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Surligner"
          >
            <Highlighter className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            onClick={() => execCommand("insertUnorderedList")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Liste à puces"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("insertOrderedList")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Liste numérotée"
          >
            <ListOrdered className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            onClick={() => execCommand("justifyLeft")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Aligner à gauche"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("justifyCenter")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Centrer"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            onClick={() => execCommand("justifyRight")}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Aligner à droite"
          >
            <AlignRight className="h-4 w-4" />
          </button>

          <div className="w-px h-5 bg-slate-200 mx-1" />

          <button
            onClick={insertLink}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
            title="Insérer un lien"
          >
            <Link className="h-4 w-4" />
          </button>

          {/* Text color */}
          <div className="relative">
            <input
              type="color"
              onChange={(e) => execCommand("foreColor", e.target.value)}
              className="absolute inset-0 opacity-0 w-8 h-8 cursor-pointer"
              title="Couleur du texte"
            />
            <div className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer">
              <div className="h-4 w-4 flex items-center justify-center text-xs font-bold">
                A
                <div className="absolute bottom-1.5 left-2 right-2 h-0.5 bg-red-500 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleNoteChange}
          className="p-6 min-h-[250px] max-h-[500px] overflow-y-auto text-sm text-slate-700 leading-relaxed focus:outline-none prose prose-sm max-w-none
            [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-3 [&_h1]:mt-4
            [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mb-2 [&_h2]:mt-3
            [&_p]:mb-2
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-2
            [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-2
            [&_li]:mb-1
            [&_a]:text-primary-600 [&_a]:underline [&_a]:hover:text-primary-700"
          data-placeholder="Cliquez ici pour ajouter des notes, informations, procédures..."
          style={{
            minHeight: "250px",
          }}
        />

        <style dangerouslySetInnerHTML={{ __html: `
          [contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: #94a3b8;
            pointer-events: none;
          }
        `}} />
      </div>

      {/* Card Detail Modal */}
      {selectedCardId && (
        <CardDetailModal
          cardId={selectedCardId}
          users={users}
          onClose={closeCard}
        />
      )}
    </div>
  );
}
