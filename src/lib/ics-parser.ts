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

function parseIcsDate(value: string): { date: Date; allDay: boolean } {
  const clean = value.replace(/^[A-Z;=]+:/, "").trim();

  if (/^\d{8}$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    return { date: new Date(y, m, d), allDay: true };
  }

  if (/^\d{8}T\d{6}Z?$/.test(clean)) {
    const y = parseInt(clean.slice(0, 4));
    const m = parseInt(clean.slice(4, 6)) - 1;
    const d = parseInt(clean.slice(6, 8));
    const hh = parseInt(clean.slice(9, 11));
    const mm = parseInt(clean.slice(11, 13));
    const ss = parseInt(clean.slice(13, 15));
    if (clean.endsWith("Z")) {
      return { date: new Date(Date.UTC(y, m, d, hh, mm, ss)), allDay: false };
    }
    return { date: new Date(y, m, d, hh, mm, ss), allDay: false };
  }

  return { date: new Date(clean), allDay: false };
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
        const end = current.DTEND
          ? parseIcsDate(current.DTEND)
          : { date: start.date, allDay: start.allDay };

        events.push({
          uid: current.UID || `${feedId}-${events.length}`,
          summary: unescapeIcs(current.SUMMARY),
          description: current.DESCRIPTION ? unescapeIcs(current.DESCRIPTION) : undefined,
          location: current.LOCATION ? unescapeIcs(current.LOCATION) : undefined,
          start: start.date.toISOString(),
          end: end.date.toISOString(),
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
    const key = line.slice(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.slice(colonIdx + 1);
    if (["DTSTART", "DTEND", "SUMMARY", "DESCRIPTION", "LOCATION", "UID"].includes(key)) {
      current[key] = key === "DTSTART" || key === "DTEND" ? line : value;
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
