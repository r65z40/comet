"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
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
  Archive,
  Bookmark,
  Trash2,
  Monitor,
  Calendar,
  HardDrive,
  Bell,
  Activity,
  LayoutGrid,
  Eye,
  Shield,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import KanbanColumn from "./KanbanColumn";
import KanbanCard from "./KanbanCard";
import CardDetailModal from "./CardDetailModal";
import CalendarPanel from "./CalendarPanel";
import BackupsWidget from "./BackupsWidget";
import AteraAlertsWidget from "./AteraAlertsWidget";
import CriticalAlertOverlay from "./CriticalAlertOverlay";
import ActivityFeedWidget from "@/components/ui/ActivityFeedWidget";
import EmisoftWidget from "./EmisoftWidget";
import DashboardGrid, { type LayoutItem } from "@/components/ui/DashboardGrid";

interface CardTag {
  id: string;
  tag: { id: string; name: string; color: string };
}

interface ChecklistItem {
  id: string;
  checked: boolean;
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
  assigneeIds?: string | null;
  assigneeNames?: string[];
  dueDate: string | null;
  links: string | null;
  tags: CardTag[];
  checklist?: ChecklistItem[];
  archived?: boolean;
  movedToColumnAt?: string;
  _count: { comments: number; attachments: number; checklist?: number };
  createdAt: string;
}

interface BoardColumn {
  id: string;
  name: string;
  color: string;
  position: number;
  cards: BoardCard[];
}

interface SavedView {
  id: string;
  name: string;
  filters: string;
  createdAt: string;
}

interface FilterState {
  search: string;
  priority: number | null;
  clientId: string | null;
  assigneeId: string | null;
  tagIds: string[];
  showArchived: boolean;
}

const defaultFilters: FilterState = {
  search: "",
  priority: null,
  clientId: null,
  assigneeId: null,
  tagIds: [],
  showArchived: false,
};

const BOARD_DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "kanban", x: 0, y: 0, w: 12, h: 7, minW: 4, minH: 3 },
  { i: "calendar", x: 0, y: 7, w: 4, h: 5, minW: 3, minH: 2 },
  { i: "notes", x: 4, y: 7, w: 4, h: 5, minW: 3, minH: 2 },
  { i: "backups", x: 8, y: 7, w: 2, h: 5, minW: 2, minH: 2 },
  { i: "atera", x: 10, y: 7, w: 2, h: 5, minW: 2, minH: 2 },
  { i: "activity_feed", x: 0, y: 12, w: 4, h: 5, minW: 2, minH: 2 },
  { i: "emsisoft", x: 4, y: 12, w: 4, h: 5, minW: 2, minH: 2 },
];

const BOARD_WIDGET_REGISTRY: Record<string, { label: string; icon: typeof ClipboardList; description: string }> = {
  kanban: { label: "Kanban", icon: ClipboardList, description: "Tableau de cartes par colonnes" },
  calendar: { label: "Calendrier", icon: Calendar, description: "Calendrier des échéances" },
  notes: { label: "Notes & Informations", icon: StickyNote, description: "Notes partagées de l'équipe" },
  backups: { label: "Sauvegardes", icon: HardDrive, description: "État des sauvegardes" },
  atera: { label: "Alertes Atera", icon: Bell, description: "Alertes de supervision Atera" },
  activity_feed: { label: "Fil d'activité", icon: Activity, description: "Flux global d'activité en temps réel" },
  emsisoft: { label: "Sécurité Emsisoft", icon: Shield, description: "Protection des appareils et menaces" },
};

export default function BoardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(
    searchParams.get("card")
  );
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("#3b82f6");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [showSaveView, setShowSaveView] = useState(false);

  // Available tags for filter
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);

  // Available clients for filter
  const [allClients, setAllClients] = useState<{ id: string; name: string }[]>([]);

  // Widget visibility
  const [widgetVisibility, setWidgetVisibility] = useState<Record<string, boolean>>({});
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const widgetPickerRef = useRef<HTMLDivElement>(null);

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
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const columnIds = useMemo(() => new Set(columns.map(c => c.id)), [columns]);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (columnIds.has(args.active.id as string)) {
      return closestCorners(args);
    }
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      const filtered = pointerCollisions.filter(
        c => !columnIds.has(c.id as string)
      );
      if (filtered.length > 0) return filtered;
      return pointerCollisions;
    }
    return rectIntersection(args);
  }, [columnIds]);

  const fetchBoard = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.showArchived) params.set("archived", "true");
      const res = await fetch(`/api/board/columns?${params}`);
      if (res.ok) {
        const data = await res.json();
        setColumns(data);
      }
    } catch {
      console.error("Erreur chargement tableau");
    } finally {
      setLoading(false);
    }
  }, [filters.showArchived]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/board/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {}
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
    } catch {}
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/board/tags");
      if (res.ok) setAllTags(await res.json());
    } catch {}
  }, []);

  const fetchViews = useCallback(async () => {
    try {
      const res = await fetch("/api/board/views");
      if (res.ok) setSavedViews(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchBoard();
    fetchUsers();
    fetchNote();
    fetchTags();
    fetchViews();
  }, [fetchBoard, fetchUsers, fetchNote, fetchTags, fetchViews]);

  useEffect(() => {
    fetchBoard();
  }, [filters.showArchived, fetchBoard]);

  useEffect(() => {
    const clientMap = new Map<string, string>();
    columns.forEach((col) =>
      col.cards.forEach((card) => {
        if (card.client) clientMap.set(card.client.id, card.client.name);
      })
    );
    setAllClients(Array.from(clientMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
  }, [columns]);

  useEffect(() => {
    if (!loading && columns.length === 0 && !initDefaultColumnsCalledRef.current) {
      initDefaultColumnsCalledRef.current = true;
      initDefaultColumns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, columns.length]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("comet_board_widget_visibility");
      if (saved) setWidgetVisibility(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (widgetPickerRef.current && !widgetPickerRef.current.contains(e.target as Node)) {
        setShowWidgetPicker(false);
      }
    }
    if (showWidgetPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showWidgetPicker]);

  function toggleWidget(widgetId: string) {
    setWidgetVisibility((prev) => {
      const next = { ...prev, [widgetId]: prev[widgetId] === false ? true : false };
      // Don't allow hiding kanban
      if (widgetId === "kanban") delete next[widgetId];
      try { localStorage.setItem("comet_board_widget_visibility", JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const enrichedColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      cards: col.cards.map((card) => {
        let ids: string[] = [];
        if (card.assigneeIds) {
          try { ids = JSON.parse(card.assigneeIds); } catch {}
        } else if (card.assigneeId) {
          ids = [card.assigneeId];
        }
        const names = ids
          .map((uid) => users.find((u) => u.id === uid)?.name)
          .filter(Boolean) as string[];
        return { ...card, assigneeNames: names };
      }),
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
    const isColumn = columns.some((col) => col.id === active.id);
    if (isColumn) {
      setActiveColumnId(active.id as string);
      setActiveCard(null);
      return;
    }
    const card = columns
      .flatMap((col) => col.cards)
      .find((c) => c.id === active.id);
    setActiveCard(card || null);
    setActiveColumnId(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    const wasDraggingColumn = activeColumnId;
    setActiveColumnId(null);

    if (!over) return;

    if (wasDraggingColumn) {
      const activeId = active.id as string;
      let overId = over.id as string;
      if (overId.startsWith("card-drop-")) {
        overId = overId.slice("card-drop-".length);
      }
      const oldIndex = columns.findIndex((c) => c.id === activeId);
      const newIndex = columns.findIndex((c) => c.id === overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const snapshot = columns;
      const reordered = arrayMove(columns, oldIndex, newIndex).map((col, i) => ({
        ...col,
        position: i,
      }));
      setColumns(reordered);

      const updates = reordered.map((col, i) => ({ id: col.id, position: i }));
      try {
        const res = await fetch("/api/board/columns", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reorder: updates }),
        });
        if (!res.ok) throw new Error("Column reorder failed");
      } catch (err) {
        console.error("Column reorder failed, rolling back:", err);
        setColumns(snapshot);
        fetchBoard();
      }
      return;
    }

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const sourceColumn = columns.find((col) =>
      col.cards.some((c) => c.id === activeCardId)
    );
    if (!sourceColumn) return;

    let targetColumnId: string;
    let targetPosition: number;

    const dropPrefix = "card-drop-";
    const isDropZone = overId.startsWith(dropPrefix);
    const colId = isDropZone ? overId.slice(dropPrefix.length) : overId;
    const targetColumn = columns.find((col) => col.id === colId);
    if (targetColumn && (isDropZone || !columns.flatMap(c => c.cards).some(c => c.id === overId))) {
      targetColumnId = targetColumn.id;
      targetPosition = targetColumn.cards.length;
    } else {
      const overColumn = columns.find((col) =>
        col.cards.some((c) => c.id === overId)
      );
      if (!overColumn) return;
      targetColumnId = overColumn.id;
      const overCard = overColumn.cards.find((c) => c.id === overId);
      targetPosition = overCard?.position ?? 0;
    }

    if (activeCardId === overId) return;

    const snapshot = columns;

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

    try {
      const res = await fetch("/api/board/cards/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: activeCardId, targetColumnId, targetPosition }),
      });
      if (!res.ok) throw new Error("Move failed");
    } catch (err) {
      console.error("Card move failed, rolling back:", err);
      setColumns(snapshot);
      fetchBoard();
    }
  }

  function handleDragOver(_event: DragOverEvent) {
    if (activeColumnId) return;
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
    } catch {} finally {
      setNoteSaving(false);
    }
  }

  function insertLink() {
    const url = prompt("URL du lien :");
    if (url) execCommand("createLink", url);
  }

  async function saveCurrentView() {
    if (!newViewName.trim()) return;
    await fetch("/api/board/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newViewName.trim(), filters }),
    });
    setNewViewName("");
    setShowSaveView(false);
    fetchViews();
  }

  function loadView(view: SavedView) {
    try {
      const parsed = JSON.parse(view.filters);
      setFilters({ ...defaultFilters, ...parsed });
    } catch {}
    setShowViewMenu(false);
  }

  async function deleteView(id: string) {
    await fetch(`/api/board/views?id=${id}`, { method: "DELETE" });
    fetchViews();
  }

  const hasActiveFilters = filters.search || filters.priority !== null || filters.clientId || filters.assigneeId || filters.tagIds.length > 0;

  const filteredColumns = enrichedColumns.map((col) => ({
    ...col,
    cards: col.cards.filter((card) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchTitle = card.title.toLowerCase().includes(q);
        const matchClient = card.client?.name.toLowerCase().includes(q);
        const matchDesc = card.description?.toLowerCase().includes(q);
        const matchTags = card.tags.some((t) => t.tag.name.toLowerCase().includes(q));
        const matchAssignee = card.assigneeNames?.some((n) => n.toLowerCase().includes(q));
        if (!matchTitle && !matchClient && !matchDesc && !matchTags && !matchAssignee) return false;
      }
      if (filters.priority !== null && card.priority !== filters.priority) return false;
      if (filters.clientId && card.clientId !== filters.clientId) return false;
      if (filters.assigneeId) {
        let ids: string[] = [];
        if (card.assigneeIds) {
          try { ids = JSON.parse(card.assigneeIds); } catch {}
        } else if (card.assigneeId) {
          ids = [card.assigneeId];
        }
        if (!ids.includes(filters.assigneeId)) return false;
      }
      if (filters.tagIds.length > 0) {
        const cardTagIds = card.tags.map((t) => t.tag.id);
        if (!filters.tagIds.some((tid) => cardTagIds.includes(tid))) return false;
      }
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

  const widgets = [
    {
      id: "kanban",
      title: "Kanban",
      icon: <ClipboardList className="h-3 w-3 text-blue-500" />,
      content: (
        <SortableContext
          items={filteredColumns.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 p-3 h-full w-full" style={{ minHeight: "200px" }}>
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
        </SortableContext>
      ),
    },
    {
      id: "calendar",
      title: "Calendrier",
      icon: <Calendar className="h-3 w-3 text-orange-500" />,
      content: <CalendarPanel />,
    },
    {
      id: "notes",
      title: "Notes & Informations",
      icon: <StickyNote className="h-3 w-3 text-amber-500" />,
      content: (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              {noteLastUpdatedBy && (
                <span className="text-[10px] text-slate-400">Modifié par {noteLastUpdatedBy}</span>
              )}
              {noteSaved && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                  <CheckCircle className="h-3 w-3" />
                  Enregistré
                </span>
              )}
            </div>
            <button
              onClick={() => saveNote()}
              disabled={noteSaving}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-[10px] rounded-lg transition-colors",
                noteSaving ? "bg-slate-100 text-slate-400" : "bg-primary-600 text-white hover:bg-primary-700"
              )}
            >
              <Save className="h-3 w-3" />
              {noteSaving ? "..." : "Enregistrer"}
            </button>
          </div>
          <div className="flex items-center gap-0.5 px-2 py-1 border-b border-slate-100 flex-wrap shrink-0">
            {[
              { cmd: () => execCommand("formatBlock", "h1"), icon: <Heading1 className="h-3.5 w-3.5" />, title: "Titre 1" },
              { cmd: () => execCommand("formatBlock", "h2"), icon: <Heading2 className="h-3.5 w-3.5" />, title: "Titre 2" },
              { cmd: () => execCommand("formatBlock", "p"), icon: <Type className="h-3.5 w-3.5" />, title: "Paragraphe" },
              null,
              { cmd: () => execCommand("bold"), icon: <Bold className="h-3.5 w-3.5" />, title: "Gras" },
              { cmd: () => execCommand("italic"), icon: <Italic className="h-3.5 w-3.5" />, title: "Italique" },
              { cmd: () => execCommand("underline"), icon: <Underline className="h-3.5 w-3.5" />, title: "Souligné" },
              { cmd: () => execCommand("strikethrough"), icon: <Strikethrough className="h-3.5 w-3.5" />, title: "Barré" },
              { cmd: () => execCommand("hiliteColor", "#fef08a"), icon: <Highlighter className="h-3.5 w-3.5" />, title: "Surligner" },
              null,
              { cmd: () => execCommand("insertUnorderedList"), icon: <List className="h-3.5 w-3.5" />, title: "Liste" },
              { cmd: () => execCommand("insertOrderedList"), icon: <ListOrdered className="h-3.5 w-3.5" />, title: "Liste num." },
              null,
              { cmd: () => execCommand("justifyLeft"), icon: <AlignLeft className="h-3.5 w-3.5" />, title: "Gauche" },
              { cmd: () => execCommand("justifyCenter"), icon: <AlignCenter className="h-3.5 w-3.5" />, title: "Centrer" },
              { cmd: () => execCommand("justifyRight"), icon: <AlignRight className="h-3.5 w-3.5" />, title: "Droite" },
              null,
              { cmd: insertLink, icon: <Link className="h-3.5 w-3.5" />, title: "Lien" },
            ].map((item, i) =>
              item === null ? (
                <div key={`sep-${i}`} className="w-px h-4 bg-slate-200 mx-0.5" />
              ) : (
                <button
                  key={i}
                  onClick={item.cmd}
                  className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                  title={item.title}
                >
                  {item.icon}
                </button>
              )
            )}
            <div className="relative">
              <input
                type="color"
                onChange={(e) => execCommand("foreColor", e.target.value)}
                className="absolute inset-0 opacity-0 w-7 h-7 cursor-pointer"
                title="Couleur du texte"
              />
              <div className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer">
                <div className="h-3.5 w-3.5 flex items-center justify-center text-[10px] font-bold">
                  A
                  <div className="absolute bottom-1 left-1.5 right-1.5 h-0.5 bg-red-500 rounded" />
                </div>
              </div>
            </div>
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleNoteChange}
            className="flex-1 p-4 text-sm text-slate-700 leading-relaxed focus:outline-none prose prose-sm max-w-none overflow-auto
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mb-3 [&_h1]:mt-4
              [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-800 [&_h2]:mb-2 [&_h2]:mt-3
              [&_p]:mb-2
              [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-2
              [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-2
              [&_li]:mb-1
              [&_a]:text-primary-600 [&_a]:underline [&_a]:hover:text-primary-700"
            data-placeholder="Cliquez ici pour ajouter des notes, informations, procédures..."
          />
          <style dangerouslySetInnerHTML={{ __html: `
            [contenteditable]:empty:before {
              content: attr(data-placeholder);
              color: #94a3b8;
              pointer-events: none;
            }
          `}} />
        </div>
      ),
    },
    {
      id: "backups",
      title: "Sauvegardes",
      icon: <HardDrive className="h-3 w-3 text-emerald-500" />,
      content: <BackupsWidget />,
    },
    {
      id: "atera",
      title: "Alertes Atera",
      icon: <Bell className="h-3 w-3 text-red-500" />,
      content: <AteraAlertsWidget />,
    },
    {
      id: "activity_feed",
      title: "Fil d'activité",
      icon: <Activity className="h-3 w-3 text-blue-500" />,
      content: <ActivityFeedWidget />,
    },
    {
      id: "emsisoft",
      title: "Sécurité Emsisoft",
      icon: <Shield className="h-3 w-3 text-purple-500" />,
      content: <EmisoftWidget />,
    },
  ];

  const visibleWidgets = widgets.filter(
    (w) => widgetVisibility[w.id] !== false
  );

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
            <p className="text-sm text-slate-500">
              {totalCards} carte{totalCards > 1 ? "s" : ""}
              {filters.showArchived && " (archivées)"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
            />
            {filters.search && (
              <button onClick={() => setFilters((f) => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
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
                hasActiveFilters ? "border-primary-300 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {hasActiveFilters && (
                <span className="w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] flex items-center justify-center">
                  {[filters.priority !== null, filters.clientId, filters.assigneeId, filters.tagIds.length > 0].filter(Boolean).length}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showFilters && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50 w-64 space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Priorité</p>
                  {[
                    { value: null, label: "Toutes" },
                    { value: 1, label: "Urgente", color: "text-red-600" },
                    { value: 2, label: "Normale", color: "text-orange-600" },
                    { value: 3, label: "Basse", color: "text-slate-600" },
                  ].map((opt) => (
                    <button key={opt.value ?? "all"} onClick={() => setFilters((f) => ({ ...f, priority: opt.value }))}
                      className={cn("w-full text-left px-2 py-1 text-sm rounded hover:bg-slate-50", filters.priority === opt.value && "bg-primary-50 text-primary-700")}>
                      <span className={opt.color}>{opt.label}</span>
                    </button>
                  ))}
                </div>
                {allClients.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Client</p>
                    <select value={filters.clientId || ""} onChange={(e) => setFilters((f) => ({ ...f, clientId: e.target.value || null }))}
                      className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500">
                      <option value="">Tous les clients</option>
                      {allClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1.5">Assigné à</p>
                  <select value={filters.assigneeId || ""} onChange={(e) => setFilters((f) => ({ ...f, assigneeId: e.target.value || null }))}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option value="">Tous</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                {allTags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1.5">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {allTags.map((tag) => (
                        <button key={tag.id}
                          onClick={() => setFilters((f) => ({ ...f, tagIds: f.tagIds.includes(tag.id) ? f.tagIds.filter((id) => id !== tag.id) : [...f.tagIds, tag.id] }))}
                          className={cn("px-2 py-0.5 text-xs rounded border transition-colors", filters.tagIds.includes(tag.id) ? "border-current font-medium" : "border-slate-200 opacity-60 hover:opacity-100")}
                          style={{ color: tag.color, backgroundColor: filters.tagIds.includes(tag.id) ? tag.color + "20" : undefined }}>
                          {tag.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={filters.showArchived} onChange={(e) => setFilters((f) => ({ ...f, showArchived: e.target.checked }))} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                    <Archive className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-sm text-slate-600">Voir les archivées</span>
                  </label>
                </div>
                {hasActiveFilters && (
                  <button onClick={() => { setFilters(defaultFilters); setShowFilters(false); }} className="w-full text-center px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded">
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Saved views */}
          <div className="relative">
            <button onClick={() => setShowViewMenu(!showViewMenu)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
              <Bookmark className="h-4 w-4" />
              Vues
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {showViewMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 w-56">
                <div className="p-2 border-b border-slate-100">
                  <p className="text-xs font-medium text-slate-500 px-1 mb-1">Vues sauvegardées</p>
                  {savedViews.length === 0 && <p className="text-xs text-slate-400 px-1 py-2">Aucune vue sauvegardée</p>}
                  {savedViews.map((v) => (
                    <div key={v.id} className="flex items-center gap-1 group">
                      <button onClick={() => loadView(v)} className="flex-1 text-left px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 rounded truncate">{v.name}</button>
                      <button onClick={() => deleteView(v.id)} className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
                <div className="p-2">
                  {showSaveView ? (
                    <div className="flex items-center gap-1.5">
                      <input type="text" placeholder="Nom de la vue..." value={newViewName} onChange={(e) => setNewViewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveCurrentView()} className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500" autoFocus />
                      <button onClick={saveCurrentView} className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700">OK</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowSaveView(true)} className="w-full flex items-center gap-1.5 px-2 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded">
                      <Plus className="h-3.5 w-3.5" />
                      Sauvegarder la vue actuelle
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Widget picker */}
          <div className="relative" ref={widgetPickerRef}>
            <button
              onClick={() => setShowWidgetPicker(!showWidgetPicker)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors",
                showWidgetPicker ? "border-primary-300 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
              title="Gérer les widgets"
            >
              <LayoutGrid className="h-4 w-4" />
              Widgets
            </button>
            {showWidgetPicker && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 w-72 p-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Widgets</h3>
                <div className="space-y-1">
                  {Object.entries(BOARD_WIDGET_REGISTRY).map(([id, info]) => {
                    const isVisible = widgetVisibility[id] !== false;
                    const isKanban = id === "kanban";
                    return (
                      <button
                        key={id}
                        onClick={() => !isKanban && toggleWidget(id)}
                        className={cn(
                          "flex items-center gap-3 w-full rounded-lg p-2.5 text-left transition-colors",
                          isKanban ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50"
                        )}
                        disabled={isKanban}
                      >
                        <div className={cn("rounded-lg p-1.5", isVisible ? "bg-primary-50" : "bg-slate-100")}>
                          <info.icon className={cn("h-4 w-4", isVisible ? "text-primary-600" : "text-slate-400")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-sm font-medium", isVisible ? "text-slate-900" : "text-slate-400")}>{info.label}</p>
                          <p className="text-[10px] text-slate-400 truncate">{info.description}</p>
                        </div>
                        {!isKanban && (
                          isVisible ? <Eye className="h-4 w-4 text-primary-500" /> : <EyeOff className="h-4 w-4 text-slate-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Screen mode */}
          <button onClick={() => router.push("/board/screen")} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors" title="Mode écran">
            <Monitor className="h-4 w-4" />
            Screen
          </button>

          {/* Add column */}
          <button onClick={() => setShowAddColumn(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Plus className="h-4 w-4" />
            Colonne
          </button>
        </div>
      </div>

      {/* Add column form */}
      {showAddColumn && (
        <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-slate-200">
          <input type="text" placeholder="Nom de la colonne" value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addColumn()} className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" autoFocus />
          <input type="color" value={newColumnColor} onChange={(e) => setNewColumnColor(e.target.value)} className="w-10 h-10 rounded border border-slate-200 cursor-pointer" />
          <button onClick={addColumn} className="px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Ajouter</button>
          <button onClick={() => setShowAddColumn(false)} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700">Annuler</button>
        </div>
      )}

      {/* Dashboard Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <DashboardGrid
          widgets={visibleWidgets}
          defaultLayout={BOARD_DEFAULT_LAYOUT}
          storageKey="comet_board_grid"
        />
        <DragOverlay>
          {activeColumnId ? (
            <div className="opacity-80 rotate-1">
              {(() => {
                const col = columns.find((c) => c.id === activeColumnId);
                if (!col) return null;
                return (
                  <div className="w-72 bg-slate-100 rounded-xl p-3 shadow-xl border-2 border-primary-400">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="text-sm font-semibold text-slate-700">{col.name}</span>
                      <span className="text-xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">{col.cards.length}</span>
                    </div>
                    <div className="space-y-1">
                      {col.cards.slice(0, 3).map((card) => (
                        <div key={card.id} className="bg-white rounded-lg p-2 text-xs text-slate-600 truncate border border-slate-200">{card.title}</div>
                      ))}
                      {col.cards.length > 3 && <div className="text-xs text-slate-400 text-center">+{col.cards.length - 3} carte(s)</div>}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : activeCard ? (
            <div className="rotate-3 opacity-90">
              <KanbanCard card={activeCard} onClick={() => {}} isDragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Card Detail Modal */}
      {selectedCardId && (
        <CardDetailModal cardId={selectedCardId} users={users} onClose={closeCard} />
      )}

      <CriticalAlertOverlay />
    </div>
  );
}
