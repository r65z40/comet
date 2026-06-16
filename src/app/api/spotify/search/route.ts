import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTracks } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  try {
    const data = await searchTracks(q, 10);

    const tracks = (data.tracks?.items || []).map((t: Record<string, unknown>) => {
      const album = t.album as Record<string, unknown> | undefined;
      const images = (album?.images || []) as { url: string }[];
      const artists = (t.artists || []) as { name: string }[];
      return {
        id: t.id,
        uri: t.uri,
        name: t.name,
        artist: artists.map((a) => a.name).join(", "),
        album: album?.name || "",
        image: images[0]?.url || images[images.length - 1]?.url || "",
        durationMs: t.duration_ms,
      };
    });

    const artists = (data.artists?.items || []).map((a: Record<string, unknown>) => {
      const images = (a.images || []) as { url: string }[];
      return {
        id: a.id,
        name: a.name,
        image: images[0]?.url || "",
        uri: a.uri,
      };
    });

    const albums = (data.albums?.items || []).map((a: Record<string, unknown>) => {
      const images = (a.images || []) as { url: string }[];
      const albumArtists = (a.artists || []) as { name: string }[];
      return {
        id: a.id,
        name: a.name,
        artist: albumArtists.map((ar) => ar.name).join(", "),
        image: images[0]?.url || "",
        uri: a.uri,
        releaseDate: a.release_date || "",
        totalTracks: a.total_tracks || 0,
      };
    });

    const playlists = (data.playlists?.items || []).map((p: Record<string, unknown>) => {
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

    return NextResponse.json({ tracks, artists, albums, playlists });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 },
    );
  }
}
