import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlaylists, getPlaylistTracks } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const playlistId = req.nextUrl.searchParams.get("id");

  try {
    if (playlistId) {
      const data = await getPlaylistTracks(playlistId);
      const tracks = (data.items || [])
        .filter((item: Record<string, unknown>) => item.track)
        .map((item: Record<string, unknown>) => {
          const t = item.track as Record<string, unknown>;
          const album = t.album as Record<string, unknown> | undefined;
          const images = (album?.images || []) as { url: string }[];
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
    }

    const data = await getUserPlaylists();
    const playlists = (data.items || []).map((p: Record<string, unknown>) => {
      const images = (p.images || []) as { url: string }[];
      const owner = p.owner as Record<string, unknown> | undefined;
      return {
        id: p.id,
        name: p.name,
        image: images[0]?.url || "",
        trackCount: (p.tracks as Record<string, unknown>)?.total || 0,
        owner: owner?.display_name || "",
        uri: p.uri,
      };
    });
    return NextResponse.json({ playlists });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
