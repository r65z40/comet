export interface CalendarEvent {
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

function parseIcsDate(value: string): { date: Date; allDay: boolean } | null {
  // Extract just the date/time portion — strip any remaining params
  const clean = value.replace(/.*:/, "").trim();

  // All-day: 20250615
  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    const date = new Date(y, m, d);
    if (isNaN(date.getTime())) return null;
    return { date, allDay: true };
  }

  // DateTime: 20250615T090000 or 20250615T090000Z
  const dtMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (dtMatch) {
    const [, ys, ms, ds, hs, mins, ss, z] = dtMatch;
    const date = z
      ? new Date(Date.UTC(+ys, +ms - 1, +ds, +hs, +mins, +ss))
      : new Date(+ys, +ms - 1, +ds, +hs, +mins, +ss);
    if (isNaN(date.getTime())) return null;
    return { date, allDay: false };
  }

  // Fallback: try native parsing
  const date = new Date(clean);
  if (isNaN(date.getTime())) return null;
  return { date, allDay: false };
}

function unfoldLines(raw: string): string[] {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\r/g, "").split("\n");
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function parseIcs(
  raw: string,
  feedId: string,
  feedName: string,
  feedColor: string,
): CalendarEvent[] {
  const lines = unfoldLines(raw);
  const events: CalendarEvent[] = [];
  let inEvent = false;
  let current: Record<string, string> = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (current.DTSTART && current.SUMMARY) {
        const start = parseIcsDate(current.DTSTART);
        if (!start) continue;

        const end = current.DTEND ? parseIcsDate(current.DTEND) : null;
        const endDate = end || { date: start.date, allDay: start.allDay };

        events.push({
          uid: current.UID || `${feedId}-${events.length}`,
          summary: unescapeIcs(current.SUMMARY),
          description: current.DESCRIPTION ? unescapeIcs(current.DESCRIPTION) : undefined,
          location: current.LOCATION ? unescapeIcs(current.LOCATION) : undefined,
          start: start.date.toISOString(),
          end: endDate.date.toISOString(),
          allDay: start.allDay,
          feedId,
          feedName,
          feedColor,
        });
      }
      continue;
    }
    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const fullKey = line.slice(0, colonIdx);
    const key = fullKey.split(";")[0].toUpperCase();
    const value = line.slice(colonIdx + 1);

    switch (key) {
      case "DTSTART":
      case "DTEND":
        // Store value only; detect VALUE=DATE for all-day
        current[key] = value;
        break;
      case "SUMMARY":
      case "DESCRIPTION":
      case "LOCATION":
      case "UID":
        current[key] = value;
        break;
    }
  }

  return events;
}

export async function fetchIcsEvents(
  url: string,
  feedId: string,
  feedName: string,
  feedColor: string,
): Promise<CalendarEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Comet-Calendar/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return parseIcs(text, feedId, feedName, feedColor);
  } finally {
    clearTimeout(timeout);
  }
}
