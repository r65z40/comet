"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Plus,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Settings,
  Eye,
  EyeOff,
  X,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
  feedId: string;
  feedName: string;
  feedColor: string;
}

interface CalendarFeed {
  id: string;
  name: string;
  url?: string;
  color: string;
  enabled: boolean;
  hidden: boolean;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export default function CalendarPanel() {
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [errors, setErrors] = useState<{ feedId: string; feedName: string; error: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [editingFeed, setEditingFeed] = useState<CalendarFeed | null>(null);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Load cached data on mount
  useEffect(() => {
    try {
      const cachedFeeds = localStorage.getItem("comet_calendar_feeds");
      const cachedEvents = localStorage.getItem("comet_calendar_events");
      if (cachedFeeds) setFeeds(JSON.parse(cachedFeeds));
      if (cachedEvents) setEvents(JSON.parse(cachedEvents));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (data?.user?.role === "ADMIN") setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  const fetchFeeds = useCallback(async () => {
    try {
      const res = await fetch("/api/board/calendars");
      if (res.ok) {
        const data = await res.json();
        setFeeds(data.feeds);
        try { localStorage.setItem("comet_calendar_feeds", JSON.stringify(data.feeds)); } catch {}
      }
    } catch { /* ignore */ }
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/board/calendars/events");
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        try { localStorage.setItem("comet_calendar_events", JSON.stringify(data.events || [])); } catch {}
        setErrors(data.errors || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFeeds();
    fetchEvents();
  }, [fetchFeeds, fetchEvents]);

  async function addFeed() {
    if (!newName.trim() || !newUrl.trim()) return;
    try {
      const res = await fetch("/api/board/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, url: newUrl, color: newColor }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { error: text || `Erreur HTTP ${res.status}` }; }
      if (!res.ok) {
        alert(data.error || `Erreur ${res.status}`);
        return;
      }
      resetForm();
      await fetchFeeds();
      await fetchEvents();
    } catch (err) {
      alert("Erreur réseau : " + (err instanceof Error ? err.message : String(err)));
    }
  }

  async function updateFeed() {
    if (!editingFeed) return;
    try {
      const res = await fetch("/api/board/calendars", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingFeed.id,
          name: newName || undefined,
          url: newUrl || undefined,
          color: newColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Erreur lors de la modification");
        return;
      }
    } catch (err) {
      alert("Erreur réseau : " + (err instanceof Error ? err.message : String(err)));
      return;
    }
    resetForm();
    await fetchFeeds();
    await fetchEvents();
  }

  async function deleteFeed(id: string) {
    if (!confirm("Supprimer cet agenda ?")) return;
    await fetch(`/api/board/calendars?id=${id}`, { method: "DELETE" });
    await fetchFeeds();
    await fetchEvents();
  }

  async function toggleUserVisibility(feedId: string, currentlyHidden: boolean) {
    await fetch("/api/board/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_visibility", feedId, hidden: !currentlyHidden }),
    });
    await fetchFeeds();
    await fetchEvents();
  }

  function resetForm() {
    setNewName("");
    setNewUrl("");
    setNewColor("#3b82f6");
    setShowAddFeed(false);
    setEditingFeed(null);
  }

  function startEdit(feed: CalendarFeed) {
    setEditingFeed(feed);
    setNewName(feed.name);
    setNewUrl(feed.url || "");
    setNewColor(feed.color);
    setShowAddFeed(true);
  }

  const today = startOfDay(new Date());
  const weekStart = addDays(today, weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const visibleFeedIds = new Set(feeds.filter(f => !f.hidden).map(f => f.id));

  function getEventsForDay(day: Date): CalendarEvent[] {
    const dayStart = startOfDay(day).getTime();
    const dayEnd = dayStart + 86400000;

    return events.filter(e => {
      if (!visibleFeedIds.has(e.feedId)) return false;
      const eStart = new Date(e.start).getTime();
      const eEnd = new Date(e.end).getTime();
      return eStart < dayEnd && eEnd > dayStart;
    });
  }

  const totalEvents = events.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          <h2 className="text-base font-semibold text-slate-800">Agendas</h2>
          {feeds.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {feeds.length} agenda{feeds.length > 1 ? "s" : ""} · {totalEvents} événement{totalEvents > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => fetchEvents()}
            disabled={loading}
            className={cn(
              "p-1.5 rounded-lg transition-colors text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              loading && "animate-spin"
            )}
            title="Rafraîchir"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setShowSettings(!showSettings); if (showSettings) resetForm(); }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              showSettings ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            )}
            title="Gérer les agendas"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-700">
              {isAdmin ? "Gestion des agendas" : "Mes agendas"}
            </h3>
            {isAdmin && (
              <button
                onClick={() => { setShowAddFeed(!showAddFeed); if (showAddFeed) resetForm(); }}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </button>
            )}
          </div>

          {/* Admin: add/edit form */}
          {isAdmin && showAddFeed && (
            <div className="bg-white rounded-lg border border-slate-200 p-3 mb-3 space-y-2">
              <p className="text-xs text-slate-500 mb-2">
                Pour obtenir l&apos;URL ICS : Outlook 365 → Paramètres → Calendrier → Calendriers partagés → Publier un calendrier → Copier le lien ICS.
              </p>
              <input
                type="text"
                placeholder="Nom (ex: Mon agenda, Équipe...)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="url"
                placeholder="URL du calendrier ICS"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Couleur :</label>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-200"
                />
                <div className="flex-1" />
                <button
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                >
                  Annuler
                </button>
                <button
                  onClick={editingFeed ? updateFeed : addFeed}
                  disabled={!newName.trim() || (!editingFeed && !newUrl.trim())}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingFeed ? "Modifier" : "Ajouter"}
                </button>
              </div>
            </div>
          )}

          {feeds.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              {isAdmin
                ? "Aucun agenda connecté. Ajoutez un calendrier ICS pour que l'équipe puisse voir les événements."
                : "Aucun agenda disponible. Un administrateur doit d'abord ajouter des calendriers."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {feeds.map(feed => (
                <div key={feed.id} className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-3 py-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: feed.color }} />
                  <span className="text-sm text-slate-700 flex-1 truncate">{feed.name}</span>

                  {/* User: toggle visibility */}
                  <button
                    onClick={() => toggleUserVisibility(feed.id, feed.hidden)}
                    className={cn(
                      "p-1 rounded transition-colors",
                      !feed.hidden ? "text-blue-500 hover:text-blue-700" : "text-slate-300 hover:text-slate-500"
                    )}
                    title={feed.hidden ? "Afficher" : "Masquer"}
                  >
                    {feed.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>

                  {/* Admin: edit + delete */}
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => startEdit(feed)}
                        className="p-1 text-slate-300 hover:text-blue-500 rounded transition-colors"
                        title="Modifier"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteFeed(feed.id)}
                        className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {errors.length > 0 && isAdmin && (
            <div className="mt-3 space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{err.feedName} : {err.error}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Week Navigation */}
      {feeds.length > 0 && (
        <>
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">
                {formatDateShort(days[0])} — {formatDateShort(days[6])}
              </span>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50"
                >
                  Aujourd&apos;hui
                </button>
              )}
            </div>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day columns */}
          <div className="grid grid-cols-7 divide-x divide-slate-100">
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, today);

              return (
                <div key={day.toISOString()} className={cn("min-h-[120px]", isToday && "bg-blue-50/40")}>
                  {/* Day header */}
                  <div className={cn(
                    "text-center py-2 border-b border-slate-100",
                    isToday && "bg-blue-50"
                  )}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                    </div>
                    <div className={cn(
                      "text-lg font-bold",
                      isToday ? "text-blue-600" : "text-slate-700"
                    )}>
                      {day.getDate()}
                    </div>
                  </div>

                  {/* Events */}
                  <div className="p-1 space-y-1">
                    {dayEvents.length === 0 && (
                      <div className="text-[10px] text-slate-300 text-center py-3">—</div>
                    )}
                    {dayEvents.map(event => {
                      const isExpanded = expandedEvent === `${event.uid}-${day.toISOString()}`;
                      return (
                        <button
                          key={`${event.uid}-${day.toISOString()}`}
                          onClick={() => setExpandedEvent(isExpanded ? null : `${event.uid}-${day.toISOString()}`)}
                          className="w-full text-left group"
                        >
                          <div
                            className={cn(
                              "rounded-md px-1.5 py-1 text-[11px] leading-tight transition-all border-l-2",
                              isExpanded ? "bg-white shadow-sm border border-slate-200" : "hover:bg-white/80"
                            )}
                            style={{ borderLeftColor: event.feedColor }}
                          >
                            {!event.allDay && (
                              <span className="font-semibold text-slate-500" style={{ color: event.feedColor }}>
                                {formatTime(event.start)}{" "}
                              </span>
                            )}
                            <span className={cn(
                              "text-slate-700",
                              !isExpanded && "line-clamp-2"
                            )}>
                              {event.summary}
                            </span>
                            {!isExpanded && (
                              <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-400">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: event.feedColor }} />
                                <span className="truncate">{event.feedName}</span>
                              </div>
                            )}

                            {isExpanded && (
                              <div className="mt-1.5 space-y-1">
                                {!event.allDay && (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <Clock className="h-3 w-3" />
                                    {formatTime(event.start)} — {formatTime(event.end)}
                                  </div>
                                )}
                                {event.location && (
                                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <MapPin className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{event.location}</span>
                                  </div>
                                )}
                                {event.description && (
                                  <p className="text-[10px] text-slate-400 line-clamp-3 whitespace-pre-line">
                                    {event.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-1 text-[10px] text-slate-300">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.feedColor }} />
                                  {event.feedName}
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Empty state */}
      {feeds.length === 0 && !showSettings && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Calendar className="h-10 w-10 text-slate-200 mb-3" />
          <p className="text-sm text-slate-400 mb-1">Aucun agenda connecté</p>
          <p className="text-xs text-slate-300 mb-4 max-w-xs">
            {isAdmin
              ? "Ajoutez des calendriers ICS (Outlook 365, Google Calendar...) pour que l'équipe puisse voir les événements."
              : "Un administrateur doit d'abord ajouter des calendriers ICS."}
          </p>
          {isAdmin && (
            <button
              onClick={() => { setShowSettings(true); setShowAddFeed(true); }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Connecter un agenda
            </button>
          )}
        </div>
      )}
    </div>
  );
}
