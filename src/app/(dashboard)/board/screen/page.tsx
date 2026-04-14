"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  X,
  Monitor,
  AlertTriangle,
  ArrowRightLeft,
  Activity,
  Clock,
  Shield,
  ShieldOff,
  ShieldAlert,
  RefreshCw,
  Zap,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TicketToast from "@/components/layout/TicketToast";

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
  assigneeIds?: string | null;
  dueDate: string | null;
  tags: CardTag[];
  archived?: boolean;
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

interface ExpiringItem {
  id: string;
  client: string;
  product: string;
  endDate: string;
  daysLeft: number;
}

interface StatusChange {
  id: string;
  client: string;
  product: string;
  oldStatus: string | null;
  newStatus: string | null;
  changedBy: string | null;
  date: string;
}

interface ActivityItem {
  id: string;
  action: string;
  entity: string;
  userName: string | null;
  details: string | null;
  date: string;
}

interface CyberNewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
}

interface FeedData {
  expiring: ExpiringItem[];
  statusChanges: StatusChange[];
  activity: ActivityItem[];
  stats: {
    enGarantie: number;
    horsGarantie: number;
    expiring30: number;
  };
  updatedAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  EN_PARC: "En parc",
  EN_PARC_GARANTIE: "En parc",
  HORS_PARC: "Hors parc",
  EN_PARC_HORS_GARANTIE: "Hors parc",
  RENOUVELE: "Renouvelé",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  RESTORE: "Restauration",
  SYNC: "Synchronisation",
  BULK_UPDATE: "Mise à jour groupée",
  BULK_DELETE: "Suppression groupée",
  LOGIN: "Connexion",
  EXPORT: "Export",
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

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

export default function BoardScreenPage() {
  const router = useRouter();
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedTab, setFeedTab] = useState<"expiring" | "changes" | "activity">("expiring");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [cyberNews, setCyberNews] = useState<CyberNewsItem[]>([]);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  // Disable auto-refresh temporarily while user is dragging to avoid visual jumps
  const isDraggingRef = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const fetchColumns = useCallback(async () => {
    if (isDraggingRef.current) return;
    try {
      const res = await fetch("/api/board/columns");
      if (res.ok) setColumns(await res.json());
    } catch {}
  }, []);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/board/screen-feed");
      if (res.ok) {
        setFeed(await res.json());
        setLastRefresh(new Date());
      }
    } catch {}
  }, []);

  const fetchCyberNews = useCallback(async () => {
    try {
      const res = await fetch("/api/board/cyber-feed");
      if (res.ok) setCyberNews(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchColumns(), fetchFeed(), fetchCyberNews()]).finally(() => setLoading(false));

    // Auto-refresh every 30 seconds (board + feed), cyber news every 10 min
    refreshIntervalRef.current = setInterval(() => {
      fetchColumns();
      fetchFeed();
    }, 30000);

    const cyberInterval = setInterval(fetchCyberNews, 10 * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      clearInterval(cyberInterval);
    };
  }, [fetchColumns, fetchFeed, fetchCyberNews]);

  // Enter fullscreen on mount
  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    }

    function handleEsc() {
      if (!document.fullscreenElement) {
        // User pressed Escape to exit fullscreen, stay on page
      }
    }
    document.addEventListener("fullscreenchange", handleEsc);
    return () => document.removeEventListener("fullscreenchange", handleEsc);
  }, []);

  function exitScreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    router.push("/board");
  }

  // Keyboard shortcut to exit
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        exitScreen();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true;
    const { active } = event;
    const card = columns.flatMap((c) => c.cards).find((c) => c.id === active.id);
    setActiveCard(card || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false;
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const sourceColumn = columns.find((col) =>
      col.cards.some((c) => c.id === activeCardId)
    );
    if (!sourceColumn) return;

    let targetColumnId: string;
    let targetPosition: number;

    const targetColumn = columns.find((col) => col.id === overId);
    if (targetColumn) {
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

    // Snapshot for rollback
    const snapshot = columns;

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

    try {
      const res = await fetch("/api/board/cards/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: activeCardId,
          targetColumnId,
          targetPosition,
        }),
      });
      if (!res.ok) throw new Error("Move failed");
    } catch {
      // Rollback on error
      setColumns(snapshot);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900 flex items-center justify-center z-[9999]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
      </div>
    );
  }

  const totalCards = columns.reduce((sum, col) => sum + col.cards.length, 0);

  return (
    <div className="fixed inset-0 bg-slate-900 text-white z-[9999] flex flex-col overflow-hidden">
      <TicketToast />
      {/* Cyber news ticker */}
      {cyberNews.length > 0 && (
        <div className="shrink-0 bg-slate-950 border-b border-slate-800 overflow-hidden h-8 flex items-center">
          <div className="flex items-center gap-2 px-3 shrink-0 bg-red-600/90 h-full z-10">
            <Zap className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-bold text-white whitespace-nowrap">CYBER</span>
          </div>
          <div className="overflow-hidden flex-1 relative">
            <div className="animate-ticker flex items-center gap-8 whitespace-nowrap">
              {cyberNews.map((item, i) => (
                <span key={i} className="inline-flex items-center gap-2 text-xs">
                  <span className="text-red-400 font-semibold">{item.source}</span>
                  <span className="text-slate-300">{item.title}</span>
                </span>
              ))}
              {/* Duplicate for seamless loop */}
              {cyberNews.map((item, i) => (
                <span key={"dup-" + i} className="inline-flex items-center gap-2 text-xs">
                  <span className="text-red-400 font-semibold">{item.source}</span>
                  <span className="text-slate-300">{item.title}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-800/80 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="h-5 w-5 text-blue-400" />
          <h1 className="text-lg font-bold">Board</h1>
          <span className="text-sm text-slate-400">
            {totalCards} carte{totalCards > 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {feed && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">{feed.stats.enGarantie}</span>
                <span className="text-slate-400">en parc</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-red-400" />
                <span className="text-red-400 font-semibold">{feed.stats.horsGarantie}</span>
                <span className="text-slate-400">hors parc</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                <span className="text-amber-400 font-semibold">{feed.stats.expiring30}</span>
                <span className="text-slate-400">expirent sous 30j</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="h-3 w-3" />
            {lastRefresh.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>

          <button
            onClick={exitScreen}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
            Quitter
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Kanban columns */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex gap-3 overflow-x-auto p-4">
            {columns.map((column) => (
              <ScreenColumn
                key={column.id}
                column={column}
                width={Math.max(260, Math.floor((100 - 25) / columns.length))}
              />
            ))}
          </div>
          <DragOverlay>
            {activeCard ? (
              <div className="rotate-3 opacity-90">
                <ScreenCard card={activeCard} isDraggingOverlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Live feed sidebar */}
        <div className="w-80 bg-slate-800/80 border-l border-slate-700 flex flex-col shrink-0 overflow-hidden">
          {/* Feed tabs */}
          <div className="flex border-b border-slate-700 shrink-0">
            <button
              onClick={() => setFeedTab("expiring")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors",
                feedTab === "expiring"
                  ? "text-amber-400 border-b-2 border-amber-400 bg-slate-700/30"
                  : "text-slate-400 hover:text-slate-300"
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Expirations
            </button>
            <button
              onClick={() => setFeedTab("changes")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors",
                feedTab === "changes"
                  ? "text-blue-400 border-b-2 border-blue-400 bg-slate-700/30"
                  : "text-slate-400 hover:text-slate-300"
              )}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Changements
            </button>
            <button
              onClick={() => setFeedTab("activity")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium transition-colors",
                feedTab === "activity"
                  ? "text-emerald-400 border-b-2 border-emerald-400 bg-slate-700/30"
                  : "text-slate-400 hover:text-slate-300"
              )}
            >
              <Activity className="h-3.5 w-3.5" />
              Activité
            </button>
          </div>

          {/* Feed content */}
          <div className="flex-1 overflow-y-auto">
            {!feed ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              </div>
            ) : feedTab === "expiring" ? (
              <div className="divide-y divide-slate-700/50">
                {feed.expiring.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    Aucune expiration prochaine
                  </div>
                )}
                {feed.expiring.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{item.client}</p>
                        <p className="text-xs text-slate-400 truncate">{item.product}</p>
                      </div>
                      <div className={cn(
                        "shrink-0 px-2 py-0.5 rounded-full text-xs font-bold",
                        item.daysLeft <= 7 ? "bg-red-500/20 text-red-400" :
                        item.daysLeft <= 30 ? "bg-amber-500/20 text-amber-400" :
                        "bg-blue-500/20 text-blue-400"
                      )}>
                        {item.daysLeft}j
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {formatDate(item.endDate)}
                    </div>
                  </div>
                ))}
              </div>
            ) : feedTab === "changes" ? (
              <div className="divide-y divide-slate-700/50">
                {feed.statusChanges.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    Aucun changement récent
                  </div>
                )}
                {feed.statusChanges.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/20 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.client}</p>
                      <p className="text-xs text-slate-400 truncate">{item.product}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                        {STATUS_LABELS[item.oldStatus || ""] || item.oldStatus || "—"}
                      </span>
                      <ArrowRightLeft className="h-3 w-3 text-slate-500" />
                      <span className={cn(
                        "text-xs px-1.5 py-0.5 rounded font-medium",
                        (item.newStatus === "HORS_PARC" || item.newStatus === "EN_PARC_HORS_GARANTIE")
                          ? "bg-red-500/20 text-red-400"
                          : (item.newStatus === "EN_PARC" || item.newStatus === "EN_PARC_GARANTIE")
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-blue-500/20 text-blue-400"
                      )}>
                        {STATUS_LABELS[item.newStatus || ""] || item.newStatus || "—"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{timeAgo(item.date)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {feed.activity.length === 0 && (
                  <div className="p-6 text-center text-slate-500 text-sm">
                    Aucune activité récente
                  </div>
                )}
                {feed.activity.map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-slate-700/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-white">
                          <span className="font-medium">{item.userName || "Système"}</span>
                          {" — "}
                          <span className="text-slate-400">{ACTION_LABELS[item.action] || item.action}</span>
                          {" "}
                          <span className="text-slate-500">{item.entity}</span>
                        </p>
                        {item.details && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{item.details}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{formatTime(item.date)} — {timeAgo(item.date)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Auto-refresh indicator */}
          <div className="shrink-0 px-4 py-2 border-t border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Actualisation auto. toutes les 30s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScreenColumn({ column, width }: { column: BoardColumn; width: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      className="flex-shrink-0 flex flex-col bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
      style={{ width: `${width}%`, minWidth: 260, maxWidth: 340 }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        <h2 className="font-semibold text-sm truncate">{column.name}</h2>
        <span className="ml-auto text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
          {column.cards.length}
        </span>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin min-h-[100px] transition-colors",
          isOver && "bg-slate-700/30"
        )}
      >
        <SortableContext
          items={column.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {column.cards.map((card) => (
            <ScreenCard key={card.id} card={card} />
          ))}
        </SortableContext>

        {column.cards.length === 0 && (
          <div
            className={cn(
              "flex items-center justify-center border-2 border-dashed rounded-lg py-6 text-xs transition-colors",
              isOver ? "border-blue-400 text-blue-300 bg-blue-500/10" : "border-slate-700 text-slate-600"
            )}
          >
            Déposez une carte ici
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenCard({ card, isDraggingOverlay }: { card: BoardCard; isDraggingOverlay?: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, disabled: isDraggingOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors: Record<number, string> = {
    1: "border-l-red-500",
    2: "border-l-orange-500",
    3: "border-l-slate-600",
  };

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-slate-700/40 rounded-lg p-3 border-l-2 hover:bg-slate-700/60 transition-colors group",
        priorityColors[card.priority] || "border-l-slate-600",
        isDragging && "opacity-30"
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
          aria-label="Glisser la carte"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white line-clamp-2">{card.title}</p>

          {card.client && (
            <div className="flex items-center gap-1.5 mt-1.5">
              {card.client.logoUrl ? (
                <img src={card.client.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
              ) : null}
              <span className="text-xs text-slate-400 truncate">{card.client.name}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {card.tags.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ backgroundColor: t.tag.color + "30", color: t.tag.color }}
              >
                {t.tag.name}
              </span>
            ))}

            {card.dueDate && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1",
                isOverdue ? "bg-red-500/20 text-red-400" : "bg-slate-600/50 text-slate-400"
              )}>
                <Clock className="h-2.5 w-2.5" />
                {formatDate(card.dueDate)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
