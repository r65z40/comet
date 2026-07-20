"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

export default function CalendarPanel({ dark = false }: { dark?: boolean }) {
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
  const swipeRef = useRef<{ x: number; t: number } | null>(null);

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
    <div className={cn(
      "rounded-xl border shadow-sm w-full h-full flex flex-col",
      dark ? "bg-slate-800/60 border-slate-700" : "bg-white border-slate-200",
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center justify-between border-b shrink-0",
        dark ? "px-5 py-3.5 border-slate-700" : "p-4 border-slate-200",
      )}>
        <div className="flex items-center gap-2.5">
          <Calendar className={cn(dark ? "h-6 w-6" : "h-5 w-5", "text-blue-500")} />
          <h2 className={cn("font-semibold", dark ? "text-lg text-slate-200" : "text-base text-slate-800")}>Agendas</h2>
          {feeds.length > 0 && (
            <span className={cn(
              "rounded-full",
              dark ? "text-sm px-2.5 py-1 text-slate-400 bg-slate-700" : "text-xs px-2 py-0.5 text-slate-400 bg-slate-100",
            )}>
              {feeds.length} agenda{feeds.length > 1 ? "s" : ""} · {totalEvents} événement{totalEvents > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className={cn("flex items-center", dark ? "gap-2" : "gap-1.5")}>
          <button
            onClick={() => fetchEvents()}
            disabled={loading}
            className={cn(
              "rounded-lg transition-colors",
              dark
                ? "p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                : "p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              loading && "animate-spin",
            )}
            title="Rafraîchir"
          >
            <RefreshCw className={dark ? "h-5 w-5" : "h-4 w-4"} />
          </button>
          <button
            onClick={() => { setShowSettings(!showSettings); if (showSettings) resetForm(); }}
            className={cn(
              "rounded-lg transition-colors",
              dark
                ? cn("p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center", showSettings ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700")
                : cn("p-1.5", showSettings ? "bg-blue-50 text-blue-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"),
            )}
            title="Gérer les agendas"
          >
            <Settings className={dark ? "h-5 w-5" : "h-4 w-4"} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className={cn(
          "border-b p-4 shrink-0",
          dark ? "border-slate-700 bg-slate-800/80" : "border-slate-200 bg-slate-50",
        )}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={cn("font-semibold", dark ? "text-base text-slate-300" : "text-sm text-slate-700")}>
              {isAdmin ? "Gestion des agendas" : "Mes agendas"}
            </h3>
            {isAdmin && (
              <button
                onClick={() => { setShowAddFeed(!showAddFeed); if (showAddFeed) resetForm(); }}
                className={cn(
                  "flex items-center gap-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors",
                  dark ? "text-sm px-4 py-2.5 min-h-[44px]" : "text-xs px-2.5 py-1.5",
                )}
              >
                <Plus className={dark ? "h-4 w-4" : "h-3.5 w-3.5"} />
                Ajouter
              </button>
            )}
          </div>

          {isAdmin && showAddFeed && (
            <div className={cn(
              "rounded-lg border p-4 mb-3 space-y-3",
              dark ? "bg-slate-700/50 border-slate-600" : "bg-white border-slate-200",
            )}>
              <p className={cn("mb-2", dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>
                Pour obtenir l&apos;URL ICS : Outlook 365 → Paramètres → Calendrier → Calendriers partagés → Publier un calendrier → Copier le lien ICS.
              </p>
              <input
                type="text"
                placeholder="Nom (ex: Mon agenda, Équipe...)"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className={cn(
                  "w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
                  dark ? "px-4 py-3 text-base bg-slate-800 border border-slate-600 text-white placeholder-slate-500" : "px-3 py-2 text-sm border border-slate-200",
                )}
              />
              <input
                type="url"
                placeholder="URL du calendrier ICS"
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                className={cn(
                  "w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono",
                  dark ? "px-4 py-3 text-sm bg-slate-800 border border-slate-600 text-white placeholder-slate-500" : "px-3 py-2 text-xs border border-slate-200",
                )}
              />
              <div className="flex items-center gap-3">
                <label className={cn(dark ? "text-sm text-slate-400" : "text-xs text-slate-500")}>Couleur :</label>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  className={cn("rounded cursor-pointer border", dark ? "w-10 h-10 border-slate-600" : "w-8 h-8 border-slate-200")}
                />
                <div className="flex-1" />
                <button
                  onClick={resetForm}
                  className={cn(
                    "transition-colors",
                    dark ? "px-4 py-2.5 text-sm text-slate-400 hover:text-slate-200" : "px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700",
                  )}
                >
                  Annuler
                </button>
                <button
                  onClick={editingFeed ? updateFeed : addFeed}
                  disabled={!newName.trim() || (!editingFeed && !newUrl.trim())}
                  className={cn(
                    "bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                    dark ? "px-5 py-2.5 text-sm min-h-[44px]" : "px-3 py-1.5 text-xs",
                  )}
                >
                  {editingFeed ? "Modifier" : "Ajouter"}
                </button>
              </div>
            </div>
          )}

          {feeds.length === 0 ? (
            <p className={cn("text-center py-4", dark ? "text-base text-slate-500" : "text-sm text-slate-400")}>
              {isAdmin
                ? "Aucun agenda connecté. Ajoutez un calendrier ICS pour que l'équipe puisse voir les événements."
                : "Aucun agenda disponible. Un administrateur doit d'abord ajouter des calendriers."}
            </p>
          ) : (
            <div className={cn(dark ? "space-y-2" : "space-y-1.5")}>
              {feeds.map(feed => (
                <div key={feed.id} className={cn(
                  "flex items-center gap-2.5 rounded-lg border",
                  dark ? "bg-slate-700/40 border-slate-600 px-4 py-3" : "bg-white border-slate-200 px-3 py-2",
                )}>
                  <div className={cn("rounded-full flex-shrink-0", dark ? "w-4 h-4" : "w-3 h-3")} style={{ backgroundColor: feed.color }} />
                  <span className={cn("flex-1 truncate", dark ? "text-base text-slate-300" : "text-sm text-slate-700")}>{feed.name}</span>

                  <button
                    onClick={() => toggleUserVisibility(feed.id, feed.hidden)}
                    className={cn(
                      "rounded-lg transition-colors",
                      dark
                        ? cn("p-2 min-h-[40px] min-w-[40px] flex items-center justify-center", !feed.hidden ? "text-blue-400 hover:text-blue-300" : "text-slate-500 hover:text-slate-300")
                        : cn("p-1", !feed.hidden ? "text-blue-500 hover:text-blue-700" : "text-slate-300 hover:text-slate-500"),
                    )}
                    title={feed.hidden ? "Afficher" : "Masquer"}
                  >
                    {feed.hidden ? <EyeOff className={dark ? "h-5 w-5" : "h-3.5 w-3.5"} /> : <Eye className={dark ? "h-5 w-5" : "h-3.5 w-3.5"} />}
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        onClick={() => startEdit(feed)}
                        className={cn(
                          "rounded-lg transition-colors",
                          dark ? "p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-blue-400" : "p-1 text-slate-300 hover:text-blue-500",
                        )}
                        title="Modifier"
                      >
                        <Pencil className={dark ? "h-5 w-5" : "h-3.5 w-3.5"} />
                      </button>
                      <button
                        onClick={() => deleteFeed(feed.id)}
                        className={cn(
                          "rounded-lg transition-colors",
                          dark ? "p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-red-400" : "p-1 text-slate-300 hover:text-red-500",
                        )}
                        title="Supprimer"
                      >
                        <Trash2 className={dark ? "h-5 w-5" : "h-3.5 w-3.5"} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {errors.length > 0 && isAdmin && (
            <div className="mt-3 space-y-1.5">
              {errors.map((err, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-2 rounded-lg",
                  dark ? "text-sm text-amber-400 bg-amber-900/20 px-4 py-2.5" : "text-xs text-amber-600 bg-amber-50 px-3 py-1.5",
                )}>
                  <AlertCircle className={cn("flex-shrink-0", dark ? "h-4 w-4" : "h-3.5 w-3.5")} />
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
          <div className={cn(
            "flex items-center justify-between border-b shrink-0",
            dark ? "px-5 py-3 border-slate-700" : "px-4 py-2 border-slate-100",
          )}>
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className={cn(
                "rounded-lg transition-colors",
                dark
                  ? "p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 active:bg-slate-600"
                  : "p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
            >
              <ChevronLeft className={dark ? "h-6 w-6" : "h-4 w-4"} />
            </button>
            <div className="flex items-center gap-3">
              <span className={cn("font-medium", dark ? "text-base text-slate-300" : "text-sm text-slate-700")}>
                {formatDateShort(days[0])} — {formatDateShort(days[6])}
              </span>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className={cn(
                    "text-blue-500 hover:text-blue-700 rounded-lg transition-colors",
                    dark ? "text-sm px-3 py-1.5 hover:bg-blue-900/30 min-h-[36px]" : "text-xs px-1.5 py-0.5 hover:bg-blue-50",
                  )}
                >
                  Aujourd&apos;hui
                </button>
              )}
            </div>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className={cn(
                "rounded-lg transition-colors",
                dark
                  ? "p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 active:bg-slate-600"
                  : "p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
            >
              <ChevronRight className={dark ? "h-6 w-6" : "h-4 w-4"} />
            </button>
          </div>

          {/* Day columns — swipeable on touch */}
          <div
            className={cn("grid grid-cols-7 divide-x flex-1 min-h-0 overflow-y-auto", dark ? "divide-slate-700" : "divide-slate-100")}
            onTouchStart={(e) => { swipeRef.current = { x: e.touches[0].clientX, t: Date.now() }; }}
            onTouchEnd={(e) => {
              if (!swipeRef.current) return;
              const dx = e.changedTouches[0].clientX - swipeRef.current.x;
              const dt = Date.now() - swipeRef.current.t;
              swipeRef.current = null;
              if (dt < 400 && Math.abs(dx) > 80) {
                setWeekOffset(w => dx < 0 ? w + 1 : w - 1);
              }
            }}
          >
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, today);

              return (
                <div key={day.toISOString()} className={cn(
                  dark ? "min-h-[180px]" : "min-h-[120px]",
                  isToday && (dark ? "bg-blue-900/20" : "bg-blue-50/40"),
                )}>
                  {/* Day header */}
                  <div className={cn(
                    "text-center border-b",
                    dark ? "py-3 border-slate-700" : "py-2 border-slate-100",
                    isToday && (dark ? "bg-blue-900/30" : "bg-blue-50"),
                  )}>
                    <div className={cn(
                      "uppercase tracking-wider",
                      dark ? "text-sm text-slate-500" : "text-[10px] text-slate-400",
                    )}>
                      {day.toLocaleDateString("fr-FR", { weekday: "short" })}
                    </div>
                    <div className={cn(
                      "font-bold",
                      dark ? "text-2xl" : "text-lg",
                      isToday ? "text-blue-500" : dark ? "text-slate-300" : "text-slate-700",
                    )}>
                      {day.getDate()}
                    </div>
                  </div>

                  {/* Events */}
                  <div className={cn(dark ? "p-2 space-y-2" : "p-1 space-y-1")}>
                    {dayEvents.length === 0 && (
                      <div className={cn("text-center", dark ? "text-sm py-4 text-slate-600" : "text-[10px] py-3 text-slate-300")}>—</div>
                    )}
                    {dayEvents.map(event => {
                      const isExpanded = expandedEvent === `${event.uid}-${day.toISOString()}`;
                      return (
                        <button
                          key={`${event.uid}-${day.toISOString()}`}
                          onClick={() => setExpandedEvent(isExpanded ? null : `${event.uid}-${day.toISOString()}`)}
                          className={cn("w-full text-left group", dark && "min-h-[40px]")}
                        >
                          <div
                            className={cn(
                              "rounded-lg leading-snug transition-all border-l-[3px]",
                              dark ? "px-2.5 py-2 text-sm" : "px-1.5 py-1 text-[11px]",
                              isExpanded
                                ? dark ? "bg-slate-700 shadow-sm border border-slate-600" : "bg-white shadow-sm border border-slate-200"
                                : dark ? "hover:bg-slate-700/60" : "hover:bg-white/80",
                            )}
                            style={{ borderLeftColor: event.feedColor }}
                          >
                            {!event.allDay && (
                              <span className={cn("font-semibold", dark ? "text-sm" : "")} style={{ color: event.feedColor }}>
                                {formatTime(event.start)}{" "}
                              </span>
                            )}
                            <span className={cn(
                              dark ? "text-slate-200" : "text-slate-700",
                              !isExpanded && "line-clamp-2",
                            )}>
                              {event.summary}
                            </span>
                            {!isExpanded && (
                              <div className={cn("flex items-center gap-1.5 mt-1", dark ? "text-xs text-slate-500" : "text-[9px] text-slate-400")}>
                                <div className={cn("rounded-full shrink-0", dark ? "w-2 h-2" : "w-1.5 h-1.5")} style={{ backgroundColor: event.feedColor }} />
                                <span className="truncate">{event.feedName}</span>
                              </div>
                            )}

                            {isExpanded && (
                              <div className={cn("space-y-1.5", dark ? "mt-2" : "mt-1.5")}>
                                {!event.allDay && (
                                  <div className={cn("flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-[10px] text-slate-400")}>
                                    <Clock className={dark ? "h-4 w-4" : "h-3 w-3"} />
                                    {formatTime(event.start)} — {formatTime(event.end)}
                                  </div>
                                )}
                                {event.location && (
                                  <div className={cn("flex items-center gap-1.5", dark ? "text-sm text-slate-400" : "text-[10px] text-slate-400")}>
                                    <MapPin className={cn("flex-shrink-0", dark ? "h-4 w-4" : "h-3 w-3")} />
                                    <span className="truncate">{event.location}</span>
                                  </div>
                                )}
                                {event.description && (
                                  <p className={cn("line-clamp-3 whitespace-pre-line", dark ? "text-sm text-slate-400" : "text-[10px] text-slate-400")}>
                                    {event.description}
                                  </p>
                                )}
                                <div className={cn("flex items-center gap-1.5", dark ? "text-sm text-slate-500" : "text-[10px] text-slate-300")}>
                                  <div className={cn("rounded-full", dark ? "w-2.5 h-2.5" : "w-2 h-2")} style={{ backgroundColor: event.feedColor }} />
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
        <div className="flex flex-col items-center justify-center py-10 text-center flex-1">
          <Calendar className={cn(dark ? "h-12 w-12 mb-4 text-slate-600" : "h-10 w-10 mb-3 text-slate-200")} />
          <p className={cn("mb-1", dark ? "text-base text-slate-400" : "text-sm text-slate-400")}>Aucun agenda connecté</p>
          <p className={cn("max-w-xs mb-4", dark ? "text-sm text-slate-500" : "text-xs text-slate-300")}>
            {isAdmin
              ? "Ajoutez des calendriers ICS (Outlook 365, Google Calendar...) pour que l'équipe puisse voir les événements."
              : "Un administrateur doit d'abord ajouter des calendriers ICS."}
          </p>
          {isAdmin && (
            <button
              onClick={() => { setShowSettings(true); setShowAddFeed(true); }}
              className={cn(
                "flex items-center gap-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors",
                dark ? "text-base px-5 py-3 min-h-[48px]" : "text-xs px-3 py-2",
              )}
            >
              <Plus className={dark ? "h-5 w-5" : "h-3.5 w-3.5"} />
              Connecter un agenda
            </button>
          )}
        </div>
      )}
    </div>
  );
}
