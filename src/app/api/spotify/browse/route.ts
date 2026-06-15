import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFeaturedPlaylists, getRecentlyPlayed } from "@/lib/spotify";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const [featured, recent] = await Promise.allSettled([
      getFeaturedPlaylists(),
      getRecentlyPlayed(),
    ]);

    const featuredPlaylists = featured.status === "fulfilled"
      ? (featured.value.playlists?.items || []).map((p: Record<string, unknown>) => {
          const images = (p.images || []) as { url: string }[];
          return {
            id: p.id,
            name: p.name,
            image: images[0]?.url || "",
            description: p.description || "",
            uri: p.uri,
          };
        })
      : [];

    const recentTracks = recent.status === "fulfilled"
      ? (recent.value.items || []).map((item: Record<string, unknown>) => {
          const t = item.track as Record<string, unknown>;
          const album = t.album as Record<string, unknown> | undefined;
          const images = (album?.images || []) as { url: string }[];
          const artists = (t.artists || []) as { name: string }[];
          return {
            id: t.id,
            uri: t.uri,
            name: t.name,
            artist: artists.map((a) => a.name).join(", "),
            image: images[images.length - 1]?.url || images[0]?.url || "",
            durationMs: t.duration_ms,
          };
        })
      : [];

    return NextResponse.json({ featuredPlaylists, recentTracks });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
