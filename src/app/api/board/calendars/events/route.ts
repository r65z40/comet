import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { fetchIcsEvents, CalendarEvent } from "@/lib/ics-parser";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const feeds = await prisma.calendarFeed.findMany({
    where: { userId: session.user?.id, enabled: true },
  });

  const results: CalendarEvent[] = [];
  const errors: { feedId: string; feedName: string; error: string }[] = [];

  await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const events = await fetchIcsEvents(feed.url, feed.id, feed.name, feed.color);
        results.push(...events);
      } catch (err) {
        errors.push({
          feedId: feed.id,
          feedName: feed.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  results.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return NextResponse.json({ events: results, errors });
}
