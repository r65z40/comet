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
  Settings,
  Calendar,
  Rss,
  HardDrive,
  Bell,
  ChevronLeft,
  ChevronRight,
  Music,
  Tv,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TicketToast from "@/components/layout/TicketToast";
import CalendarPanel from "../CalendarPanel";
import BackupsWidget from "../BackupsWidget";
import AteraAlertsWidget from "../AteraAlertsWidget";
import CriticalAlertOverlay from "../CriticalAlertOverlay";
import DashboardGrid, { type LayoutItem } from "@/components/ui/DashboardGrid";
import ActivityFeedWidget from "@/components/ui/ActivityFeedWidget";
import EmisoftWidget from "../EmisoftWidget";
import EmisoftAlertsWidget from "../EmisoftAlertsWidget";
import SpotifyWidget from "../SpotifyWidget";
import VideoPlayerWidget from "../VideoPlayerWidget";

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

interface ScreenVisibility {
  showCyberNews: boolean;
  showFeed: boolean;
  showCalendar: boolean;
  showBackups: boolean;
  showAtera: boolean;
  showActivityFeed: boolean;
  showEmsisoft: boolean;
  showEmsisoftAlerts: boolean;
  showSpotify: boolean;
  showVideoPlayer: boolean;
}

const DEFAULT_VISIBILITY: ScreenVisibility = {
  showCyberNews: true,
  showFeed: true,
  showCalendar: false,
  showBackups: true,
  showAtera: true,
  showActivityFeed: true,
  showEmsisoft: true,
  showEmsisoftAlerts: true,
  showSpotify: true,
  showVideoPlayer: false,
};

const SCREEN_DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "cybernews", x: 0, y: 0, w: 12, h: 1, minW: 6, minH: 1, maxH: 1 },
  { i: "kanban", x: 0, y: 1, w: 8, h: 8, minW: 3, minH: 3 },
  { i: "feed", x: 8, y: 1, w: 4, h: 4, minW: 2, minH: 2 },
  { i: "backups", x: 8, y: 5, w: 2, h: 4, minW: 2, minH: 2 },
  { i: "atera", x: 10, y: 5, w: 2, h: 4, minW: 2, minH: 2 },
  { i: "activity_feed", x: 0, y: 12, w: 4, h: 4, minW: 2, minH: 2 },
  { i: "emsisoft", x: 4, y: 12, w: 4, h: 4, minW: 2, minH: 2 },
  { i: "emsisoft_alerts", x: 8, y: 12, w: 4, h: 4, minW: 2, minH: 3 },
  { i: "spotify", x: 0, y: 16, w: 3, h: 4, minW: 2, minH: 3 },
  { i: "video_player", x: 3, y: 16, w: 6, h: 5, minW: 3, minH: 3 },
  { i: "calendar", x: 9, y: 16, w: 3, h: 3, minW: 3, minH: 2 },
];

const STATUS_LABELS: Record<string, string> = {
  EN_PARC: "En parc",
  HORS_PARC: "Hors parc",
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
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
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
  const [visibility, setVisibility] = useState<ScreenVisibility>(DEFAULT_VISIBILITY);
  const [showSettings, setShowSettings] = useState(false);
  const isDraggingRef = useRef(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("comet_screen_visibility");
      if (saved) setVisibility(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setGridHeight(Math.floor(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        settingsRef.current &&
        !settingsRef.current.contains(target) &&
        !settingsButtonRef.current?.contains(target)
      ) {
        setShowSettings(false);
      }
    }
    if (showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSettings]);

  function updateVisibility(patch: Partial<ScreenVisibility>) {
    setVisibility((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem("comet_screen_visibility", JSON.stringify(next)); } catch {}
      return next;
    });
  }

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

    function startPolling() {
      if (refreshIntervalRef.current) return;
      refreshIntervalRef.current = setInterval(() => {
        fetchColumns();
        fetchFeed();
      }, 30000);
    }
    function stopPolling() {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
    function handleVisibility() {
      if (document.hidden) stopPolling(); else startPolling();
    }

    startPolling();
    const cyberInterval = setInterval(fetchCyberNews, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stopPolling();
      clearInterval(cyberInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchColumns, fetchFeed, fetchCyberNews]);

  useEffect(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    }
    function handleEsc() {}
    document.addEventListener("fullscreenchange", handleEsc);
    return () => document.removeEventListener("fullscreenchange", handleEsc);
  }, []);

  function exitScreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    router.push("/board");
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") exitScreen();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragStart(event: DragStartEvent) {
    isDraggingRef.current = true;
    const card = columns.flatMap((c) => c.cards).find((c) => c.id === event.active.id);
    setActiveCard(card || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    isDraggingRef.current = false;
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;
    const sourceColumn = columns.find((col) => col.cards.some((c) => c.id === activeCardId));
    if (!sourceColumn) return;

    let targetColumnId: string;
    let targetPosition: number;
    const targetColumn = columns.find((col) => col.id === overId);
    if (targetColumn) {
      targetColumnId = targetColumn.id;
      targetPosition = targetColumn.cards.length;
    } else {
      const overColumn = columns.find((col) => col.cards.some((c) => c.id === overId));
      if (!overColumn) return;
      targetColumnId = overColumn.id;
      targetPosition = overColumn.cards.find((c) => c.id === overId)?.position ?? 0;
    }
    if (activeCardId === overId) return;

    const snapshot = columns;
    setColumns((prev) => {
      const next = prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== activeCardId) }));
      const card = sourceColumn.cards.find((c) => c.id === activeCardId);
      if (card) {
        const targetCol = next.find((c) => c.id === targetColumnId);
        if (targetCol) {
          targetCol.cards.splice(targetPosition, 0, { ...card, columnId: targetColumnId });
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
    } catch {
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
  const screenRowHeight = gridHeight > 0 ? Math.max(20, Math.floor((gridHeight - 88) / 12)) : 60;

  const widgets = [
    ...(visibility.showCyberNews && cyberNews.length > 0
      ? [{
          id: "cybernews",
          title: "Cyber News",
          icon: <Zap className="h-3 w-3 text-red-400" />,
          content: (
            <div className="overflow-hidden flex items-center h-full bg-slate-950">
              <div className="flex items-center gap-2 px-3 shrink-0 bg-red-600/90 h-full">
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
                  {cyberNews.map((item, i) => (
                    <span key={"dup-" + i} className="inline-flex items-center gap-2 text-xs">
                      <span className="text-red-400 font-semibold">{item.source}</span>
                      <span className="text-slate-300">{item.title}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ),
        }]
      : []),
    {
      id: "kanban",
      title: `Kanban (${totalCards} carte${totalCards > 1 ? "s" : ""})`,
      icon: <Monitor className="h-3 w-3 text-blue-400" />,
      content: (
        <KanbanContent
          columns={columns}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          activeCard={activeCard}
        />
      ),
    },
    ...(visibility.showFeed
      ? [{
          id: "feed",
          title: "Flux en direct",
          icon: <Rss className="h-3 w-3 text-amber-400" />,
          content: <FeedContent feed={feed} feedTab={feedTab} setFeedTab={setFeedTab} />,
        }]
      : []),
    ...(visibility.showBackups
      ? [{
          id: "backups",
          title: "Sauvegardes",
          icon: <HardDrive className="h-3 w-3 text-emerald-400" />,
          content: <BackupsWidget dark />,
        }]
      : []),
    ...(visibility.showAtera
      ? [{
          id: "atera",
          title: "Alertes Atera",
          icon: <Bell className="h-3 w-3 text-red-400" />,
          content: <AteraAlertsWidget dark />,
        }]
      : []),
    ...(visibility.showActivityFeed
      ? [{
          id: "activity_feed",
          title: "Fil d'activité",
          icon: <Activity className="h-3 w-3 text-blue-400" />,
          content: <ActivityFeedWidget dark />,
        }]
      : []),
    ...(visibility.showEmsisoft
      ? [{
          id: "emsisoft",
          title: "Sécurité Emsisoft",
          icon: <Shield className="h-3 w-3 text-purple-400" />,
          content: <EmisoftWidget dark />,
        }]
      : []),
    ...(visibility.showEmsisoftAlerts
      ? [{
          id: "emsisoft_alerts",
          title: "Alertes Emsisoft",
          icon: <ShieldAlert className="h-3 w-3 text-red-400" />,
          content: <EmisoftAlertsWidget dark />,
        }]
      : []),
    ...(visibility.showSpotify
      ? [{
          id: "spotify",
          title: "Spotify",
          icon: <Music className="h-3 w-3 text-green-400" />,
          content: <SpotifyWidget dark />,
        }]
      : []),
    ...(visibility.showVideoPlayer
      ? [{
          id: "video_player",
          title: "Lecteur vidéo",
          icon: <Tv className="h-3 w-3 text-cyan-400" />,
          content: <VideoPlayerWidget dark />,
        }]
      : []),
    ...(visibility.showCalendar
      ? [{
          id: "calendar",
          title: "Calendrier",
          icon: <Calendar className="h-3 w-3 text-orange-400" />,
          content: <CalendarPanel dark />,
        }]
      : []),
  ];

  return (
    <div className="fixed inset-0 bg-slate-900 text-white z-[9999] flex flex-col overflow-hidden">
      <TicketToast />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-2 bg-slate-800/80 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="h-5 w-5 text-blue-400" />
          <h1 className="text-lg font-bold">Board</h1>
          <span className="text-sm text-slate-400">{totalCards} carte{totalCards > 1 ? "s" : ""}</span>
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

          {/* Widget visibility settings */}
          <div className="relative">
            <button
              ref={settingsButtonRef}
              onClick={() => setShowSettings(!showSettings)}
              className={cn("flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[44px] min-w-[44px] text-sm rounded-lg transition-colors", showSettings ? "bg-blue-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-300")}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>

          <button onClick={exitScreen} className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] text-sm bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
            <X className="h-5 w-5" />
            Quitter
          </button>
        </div>
      </div>

      {/* Settings drawer (slide-in from right) */}
      <div
        className={cn(
          "fixed inset-0 z-[9997] bg-black/50 transition-opacity",
          showSettings ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setShowSettings(false)}
      />
      <div
        ref={settingsRef}
        className={cn(
          "fixed top-0 right-0 h-full w-80 z-[9998] bg-slate-800 border-l border-slate-600 shadow-2xl transition-transform duration-300 ease-out flex flex-col",
          showSettings ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h3 className="text-base font-semibold text-white">Widgets</h3>
          <button
            onClick={() => setShowSettings(false)}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs text-slate-500 mb-4">Glissez les widgets pour les réorganiser. Redimensionnez avec le coin bas-droit.</p>
          {[
            { key: "showCyberNews" as const, label: "Bandeau cyber" },
            { key: "showFeed" as const, label: "Flux en direct" },
            { key: "showBackups" as const, label: "Sauvegardes" },
            { key: "showAtera" as const, label: "Alertes Atera" },
            { key: "showActivityFeed" as const, label: "Fil d'activité" },
            { key: "showEmsisoft" as const, label: "Sécurité Emsisoft" },
            { key: "showEmsisoftAlerts" as const, label: "Alertes Emsisoft (live)" },
            { key: "showSpotify" as const, label: "Spotify" },
            { key: "showVideoPlayer" as const, label: "Lecteur vidéo" },
            { key: "showCalendar" as const, label: "Calendrier" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-b-0">
              <span className="text-sm text-slate-300">{label}</span>
              <button
                onClick={() => updateVisibility({ [key]: !visibility[key] })}
                className={cn("relative w-12 h-7 rounded-full transition-colors shrink-0", visibility[key] ? "bg-blue-600" : "bg-slate-600")}
              >
                <div className={cn("absolute top-0.5 w-6 h-6 rounded-full bg-white transition-transform", visibility[key] ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Grid content */}
      <div ref={gridContainerRef} className="flex-1 overflow-auto p-1 pb-6">
        <DashboardGrid
          widgets={widgets}
          defaultLayout={SCREEN_DEFAULT_LAYOUT}
          storageKey="comet_screen_grid"
          dark
          rowHeight={screenRowHeight}
        />
      </div>

      <CriticalAlertOverlay dark />
    </div>
  );
}

/* Feed content component */
function FeedContent({
  feed,
  feedTab,
  setFeedTab,
}: {
  feed: FeedData | null;
  feedTab: "expiring" | "changes" | "activity";
  setFeedTab: (tab: "expiring" | "changes" | "activity") => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-slate-700 shrink-0">
        {[
          { key: "expiring" as const, label: "Expirations", icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "amber" },
          { key: "changes" as const, label: "Changements", icon: <ArrowRightLeft className="h-3.5 w-3.5" />, color: "blue" },
          { key: "activity" as const, label: "Activité", icon: <Activity className="h-3.5 w-3.5" />, color: "emerald" },
        ].map(({ key, label, icon, color }) => (
          <button
            key={key}
            onClick={() => setFeedTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors",
              feedTab === key ? `text-${color}-400 border-b-2 border-${color}-400 bg-slate-700/30` : "text-slate-400 hover:text-slate-300"
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {!feed ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
          </div>
        ) : feedTab === "expiring" ? (
          <div className="divide-y divide-slate-700/50">
            {feed.expiring.length === 0 && <div className="p-6 text-center text-slate-500 text-sm">Aucune expiration prochaine</div>}
            {feed.expiring.map((item) => (
              <div key={item.id} className="px-4 py-3 hover:bg-slate-700/20 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{item.client}</p>
                    <p className="text-xs text-slate-400 truncate">{item.product}</p>
                  </div>
                  <div className={cn(
                    "shrink-0 px-2 py-0.5 rounded-full text-xs font-bold",
                    item.daysLeft <= 7 ? "bg-red-500/20 text-red-400" : item.daysLeft <= 30 ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"
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
            {feed.statusChanges.length === 0 && <div className="p-6 text-center text-slate-500 text-sm">Aucun changement récent</div>}
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
                    item.newStatus === "HORS_PARC" ? "bg-red-500/20 text-red-400" : item.newStatus === "EN_PARC" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
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
            {feed.activity.length === 0 && <div className="p-6 text-center text-slate-500 text-sm">Aucune activité récente</div>}
            {feed.activity.map((item) => (
              <div key={item.id} className="px-4 py-3 hover:bg-slate-700/20 transition-colors">
                <p className="text-sm text-white">
                  <span className="font-medium">{item.userName || "Système"}</span>
                  {" — "}
                  <span className="text-slate-400">{ACTION_LABELS[item.action] || item.action}</span>
                  {" "}
                  <span className="text-slate-500">{item.entity}</span>
                </p>
                {item.details && <p className="text-xs text-slate-500 truncate mt-0.5">{item.details}</p>}
                <p className="text-xs text-slate-600 mt-1">{formatTime(item.date)} — {timeAgo(item.date)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 px-4 py-2 border-t border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Actualisation auto. toutes les 30s
        </div>
      </div>
    </div>
  );
}

/* Kanban content with horizontal scroll-snap and touch navigation arrows */
function KanbanContent({
  columns,
  sensors,
  onDragStart,
  onDragEnd,
  activeCard,
}: {
  columns: BoardColumn[];
  sensors: ReturnType<typeof useSensors>;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  activeCard: BoardCard | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, columns]);

  function scrollByAmount(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="relative h-full">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto p-3 h-full snap-x snap-mandatory scroll-smooth"
        >
          {columns.map((column) => (
            <ScreenColumn key={column.id} column={column} colCount={columns.length} />
          ))}
        </div>

        {/* Left edge fade */}
        <div
          className={cn(
            "pointer-events-none absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-slate-900/80 to-transparent transition-opacity",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Right edge fade */}
        <div
          className={cn(
            "pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-slate-900/80 to-transparent transition-opacity",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              scrollByAmount(-300);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-11 w-11 rounded-full bg-slate-800/70 hover:bg-slate-700/90 text-white shadow-lg transition-colors"
            aria-label="Faire défiler vers la gauche"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              scrollByAmount(300);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-11 w-11 rounded-full bg-slate-800/70 hover:bg-slate-700/90 text-white shadow-lg transition-colors"
            aria-label="Faire défiler vers la droite"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="rotate-3 opacity-90">
            <ScreenCard card={activeCard} isDraggingOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* Screen column */
function ScreenColumn({ column, colCount }: { column: BoardColumn; colCount: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      className="snap-start shrink-0 flex flex-col bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden"
      style={{ width: `${Math.max(220, Math.floor(100 / colCount))}%`, minWidth: 220, maxWidth: 340 }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/50">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        <h2 className="font-semibold text-sm truncate">{column.name}</h2>
        <span className="ml-auto text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{column.cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn("flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin min-h-[60px] transition-colors", isOver && "bg-slate-700/30")}
      >
        <SortableContext items={column.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => <ScreenCard key={card.id} card={card} />)}
        </SortableContext>
        {column.cards.length === 0 && (
          <div className={cn("flex items-center justify-center border-2 border-dashed rounded-lg py-4 text-xs transition-colors", isOver ? "border-blue-400 text-blue-300 bg-blue-500/10" : "border-slate-700 text-slate-600")}>
            Déposez ici
          </div>
        )}
      </div>
    </div>
  );
}

/* Screen card */
function ScreenCard({ card, isDraggingOverlay }: { card: BoardCard; isDraggingOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: isDraggingOverlay });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const priorityColors: Record<number, string> = { 1: "border-l-red-500", 2: "border-l-orange-500", 3: "border-l-slate-600" };
  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-slate-700/40 rounded-lg border-l-2 hover:bg-slate-700/60 transition-colors cursor-grab active:cursor-grabbing touch-none select-none",
        priorityColors[card.priority] || "border-l-slate-600",
        isDragging && "opacity-30",
      )}
    >
      {card.client && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20 rounded-t-lg">
          {card.client.logoUrl && <img src={card.client.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover" />}
          <span className="text-xs font-bold text-blue-300 truncate">{card.client.name}</span>
        </div>
      )}
      <div className="px-3 py-2">
        <p className="text-sm font-medium text-white line-clamp-2">{card.title}</p>
        {(card.tags.length > 0 || card.dueDate) && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {card.tags.slice(0, 3).map((t) => (
              <span key={t.id} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: t.tag.color + "30", color: t.tag.color }}>
                {t.tag.name}
              </span>
            ))}
            {card.dueDate && (
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1", isOverdue ? "bg-red-500/20 text-red-400" : "bg-slate-600/50 text-slate-400")}>
                <Clock className="h-2.5 w-2.5" />
                {formatDate(card.dueDate)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
