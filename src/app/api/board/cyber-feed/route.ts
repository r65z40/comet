import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface CyberNewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
}

// Cache to avoid hammering feeds
let cache: { items: CyberNewsItem[]; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const RSS_FEEDS = [
  { url: "https://www.cert.ssi.gouv.fr/feed/", source: "CERT-FR" },
  { url: "https://feeds.feedburner.com/TheHackersNews", source: "The Hacker News" },
  { url: "https://www.bleepingcomputer.com/feed/", source: "BleepingComputer" },
];

function parseItems(xml: string, source: string): CyberNewsItem[] {
  const items: CyberNewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      ?.replace(/&amp;/g, "&")
      ?.replace(/&lt;/g, "<")
      ?.replace(/&gt;/g, ">")
      ?.replace(/&quot;/g, '"')
      ?.trim();
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      ?.trim();
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim()
      || block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1]?.trim()
      || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim();

    if (title) {
      items.push({
        title,
        link: link || "",
        source,
        date: pubDate || new Date().toISOString(),
      });
    }
  }
  return items;
}

async function fetchAllFeeds(): Promise<CyberNewsItem[]> {
  const allItems: CyberNewsItem[] = [];

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          signal: AbortSignal.timeout(5000),
          headers: { "User-Agent": "Comet/1.0 RSS Reader" },
        });
        if (!res.ok) return;
        const xml = await res.text();
        const items = parseItems(xml, feed.source);
        allItems.push(...items.slice(0, 10));
      } catch {
        // Feed unavailable, skip
      }
    })
  );

  // Sort by date descending and limit
  allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return allItems.slice(0, 20);
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.items);
  }

  const items = await fetchAllFeeds();
  cache = { items, fetchedAt: Date.now() };

  return NextResponse.json(items);
}
