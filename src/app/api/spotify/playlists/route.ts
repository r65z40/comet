import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlaylists, spotifyFetch } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const playlistId = req.nextUrl.searchParams.get("id");

  try {
    if (playlistId) {
      // Try /playlists/{id} first (full object with tracks embedded)
      const res = await spotifyFetch(`/playlists/${playlistId}`);
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Spotify ${res.status}`, tracks: [], detail: text },
          { status: 200 },
        );
      }
      const data = await res.json();

      // data.tracks is a paging object { items: [...], total, ... }
      let rawItems: Record<string, unknown>[] = [];
      if (data.tracks && Array.isArray(data.tracks.items)) {
        rawItems = data.tracks.items;
      } else if (Array.isArray(data.tracks)) {
        rawItems = data.tracks;
      } else if (Array.isArray(data.items)) {
        rawItems = data.items;
      }

      const tracks = rawItems
        .filter((item) => item && item.track)
        .map((item) => {
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
      return NextResponse.json({ tracks, total: data.tracks?.total || tracks.length });
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
