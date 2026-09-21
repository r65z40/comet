import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

interface NewsItem {
  title: string;
  link: string;
  source: string;
  date: string;
  category: string;
}

let cache: { items: NewsItem[]; fetchedAt: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

const RSS_FEEDS = [
  { url: "https://www.france24.com/fr/rss", source: "France 24", category: "Monde" },
  { url: "https://www.lemonde.fr/international/rss_full.xml", source: "Le Monde", category: "International" },
  { url: "https://www.rfi.fr/fr/rss", source: "RFI", category: "Monde" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World", category: "World" },
  { url: "https://www.lepoint.fr/24h-infos/rss.xml", source: "Le Point", category: "Actualités" },
];

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseItems(xml: string, source: string, category: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const link = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      ?.trim();
    const pubDate =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ||
      block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1]?.trim() ||
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim();

    if (title) {
      items.push({
        title: decodeEntities(title),
        link: link || "",
        source,
        date: pubDate || new Date().toISOString(),
        category,
      });
    }
  }
  return items;
}

async function fetchAllFeeds(): Promise<NewsItem[]> {
  const allItems: NewsItem[] = [];

  await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": "Comet/1.0 RSS Reader" },
        });
        if (!res.ok) return;
        const xml = await res.text();
        const items = parseItems(xml, feed.source, feed.category);
        allItems.push(...items.slice(0, 15));
      } catch {
        // Feed unavailable
      }
    })
  );

  allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return allItems.slice(0, 40);
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
