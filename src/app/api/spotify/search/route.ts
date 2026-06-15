import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTracks } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  try {
    const data = await searchTracks(q);
    const tracks = (data.tracks?.items || []).map((t: Record<string, unknown>) => {
      const album = t.album as Record<string, unknown> | undefined;
      const images = (album?.images || []) as { url: string; width: number }[];
      const artists = (t.artists || []) as { name: string }[];
      return {
        id: t.id,
        uri: t.uri,
        name: t.name,
        artist: artists.map((a) => a.name).join(", "),
        album: album?.name || "",
        image: images[images.length - 1]?.url || images[0]?.url || "",
        durationMs: t.duration_ms,
      };
    });
    return NextResponse.json({ tracks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Search failed" }, { status: 500 });
  }
}
