"use client";

import { useEffect, useState } from "react";
import { Clock, Package, FileText, MessageSquare, LayoutGrid, RefreshCw, ChevronDown, Wrench, Activity } from "lucide-react";
import type { TimelineEvent } from "@/app/api/clients/[id]/timeline/route";

const TYPE_CONFIG: Record<TimelineEvent["type"], { icon: typeof Clock; color: string; bg: string }> = {
  installation: { icon: Package, color: "text-emerald-600", bg: "bg-emerald-100" },
  installation_change: { icon: Wrench, color: "text-amber-600", bg: "bg-amber-100" },
  invoice: { icon: FileText, color: "text-blue-600", bg: "bg-blue-100" },
  ticket: { icon: MessageSquare, color: "text-red-600", bg: "bg-red-100" },
  ticket_comment: { icon: MessageSquare, color: "text-orange-600", bg: "bg-orange-100" },
  board_card: { icon: LayoutGrid, color: "text-violet-600", bg: "bg-violet-100" },
  activity: { icon: Activity, color: "text-slate-600", bg: "bg-slate-100" },
};

const TYPE_LABELS: Record<string, string> = {
  installation: "Installations",
  installation_change: "Modifications",
  invoice: "Factures",
  ticket: "Tickets",
  ticket_comment: "Réponses tickets",
  board_card: "Cartes",
  activity: "Activité",
};

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function groupByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();
  for (const ev of events) {
    const d = new Date(ev.date);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = "Aujourd'hui";
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = "Hier";
    } else {
      label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    }
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(ev);
  }
  return groups;
}

export default function ClientTimelineSection({ clientId }: { clientId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(30);
  const [filter, setFilter] = useState<TimelineEvent["type"] | "all">("all");

  useEffect(() => {
    fetch(`/api/clients/${clientId}/timeline?limit=200`)
      .then((r) => r.json())
      .then((data) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);
  const visible = filtered.slice(0, visibleCount);
  const grouped = groupByDate(visible);

  const typeCounts = new Map<string, number>();
  for (const e of events) {
    typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
          <span className="text-xs text-slate-400">({events.length})</span>
        </div>
        {!loading && (
          <button
            onClick={() => { setLoading(true); fetch(`/api/clients/${clientId}/timeline?limit=200`).then(r => r.json()).then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false)); }}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-2.5">
        <button
          onClick={() => { setFilter("all"); setVisibleCount(30); }}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${filter === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Tout ({events.length})
        </button>
        {(["installation", "installation_change", "invoice", "ticket", "board_card", "activity"] as const).map((t) => {
          const count = typeCounts.get(t) || 0;
          if (count === 0) return null;
          const cfg = TYPE_CONFIG[t];
          return (
            <button
              key={t}
              onClick={() => { setFilter(t); setVisibleCount(30); }}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${filter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              <span className={filter !== t ? cfg.color : ""}>{TYPE_LABELS[t]}</span> ({count})
            </button>
          );
        })}
      </div>

      {/* Timeline */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Aucun événement</p>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([dateLabel, dayEvents]) => (
              <div key={dateLabel}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{dateLabel}</span>
                  <div className="flex-1 border-t border-slate-100" />
                </div>
                <div className="relative ml-3 border-l-2 border-slate-100 pl-5 space-y-3">
                  {dayEvents.map((ev) => {
                    const cfg = TYPE_CONFIG[ev.type];
                    const Icon = cfg.icon;
                    return (
                      <div key={ev.id} className="relative group">
                        <div className={`absolute -left-[29px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full ${cfg.bg}`}>
                          <Icon className={`h-3 w-3 ${cfg.color}`} />
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-slate-800 leading-snug">{ev.title}</p>
                            {ev.detail && (
                              <p className="mt-0.5 text-xs text-slate-500 truncate">{ev.detail}</p>
                            )}
                            {ev.meta?.changedBy && (
                              <p className="mt-0.5 text-xs text-slate-400">par {ev.meta.changedBy}</p>
                            )}
                            {ev.meta?.userName && ev.type === "activity" && (
                              <p className="mt-0.5 text-xs text-slate-400">par {ev.meta.userName}</p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-slate-400 mt-0.5">{formatRelative(ev.date)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filtered.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((c) => c + 30)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Voir plus ({filtered.length - visibleCount} restants)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
