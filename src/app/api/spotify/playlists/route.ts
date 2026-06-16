import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPlaylists, spotifyFetch } from "@/lib/spotify";

function extractTrack(item: Record<string, unknown>) {
  const t = (item.track ?? item) as Record<string, unknown>;
  if (!t || !t.id) return null;
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
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const playlistId = req.nextUrl.searchParams.get("id");

  try {
    if (playlistId) {
      const res = await spotifyFetch(`/playlists/${playlistId}`);
      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Spotify ${res.status}`, tracks: [], detail: text },
          { status: 200 },
        );
      }
      const data = await res.json();

      let rawItems: Record<string, unknown>[] = [];
      if (data.tracks && Array.isArray(data.tracks.items)) {
        rawItems = data.tracks.items;
      } else if (Array.isArray(data.tracks)) {
        rawItems = data.tracks;
      } else if (Array.isArray(data.items)) {
        rawItems = data.items;
      }

      let tracks = rawItems
        .map((item) => item ? extractTrack(item) : null)
        .filter(Boolean);

      // If paging object has next pages, fetch them all
      let nextUrl = data.tracks?.next as string | null;
      while (nextUrl) {
        const pageRes = await spotifyFetch(nextUrl.replace("https://api.spotify.com/v1", ""));
        if (!pageRes.ok) break;
        const pageData = await pageRes.json();
        const pageItems = (pageData.items || []) as Record<string, unknown>[];
        tracks = tracks.concat(
          pageItems.map((item) => item ? extractTrack(item) : null).filter(Boolean),
        );
        nextUrl = pageData.next as string | null;
      }

      return NextResponse.json({
        tracks,
        total: data.tracks?.total || tracks.length,
        debug: {
          hasTracksObj: !!data.tracks,
          hasTracksItems: Array.isArray(data.tracks?.items),
          rawItemCount: rawItems.length,
          firstItemKeys: rawItems[0] ? Object.keys(rawItems[0]) : [],
          firstItemHasTrack: rawItems[0] ? !!rawItems[0].track : false,
        },
      });
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
