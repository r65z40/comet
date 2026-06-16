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
      const debug: Record<string, unknown> = {};

      // Strategy 1: /playlists/{id}/tracks with market param
      try {
        const tracksRes = await spotifyFetch(`/playlists/${playlistId}/tracks?market=FR&limit=100&additional_types=track`);
        debug.tracksEndpointStatus = tracksRes.status;

        if (tracksRes.ok) {
          const tracksData = await tracksRes.json();
          debug.tracksEndpointKeys = Object.keys(tracksData);
          debug.tracksEndpointItemCount = Array.isArray(tracksData.items) ? tracksData.items.length : 0;

          const rawItems: Record<string, unknown>[] = Array.isArray(tracksData.items) ? tracksData.items : [];

          let tracks = rawItems
            .map((item) => item ? extractTrack(item) : null)
            .filter(Boolean);

          // Fetch additional pages
          let nextUrl = tracksData.next as string | null;
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

          if (tracks.length > 0) {
            return NextResponse.json({
              tracks,
              total: tracksData.total || tracks.length,
              debug: { source: "tracks-endpoint", ...debug },
            });
          }

          // Check first item structure for diagnosis
          if (rawItems.length > 0) {
            debug.firstItemKeys = Object.keys(rawItems[0]);
            debug.firstItemTrackType = rawItems[0].track ? typeof rawItems[0].track : "missing";
            if (rawItems[0].track && typeof rawItems[0].track === "object") {
              debug.firstTrackKeys = Object.keys(rawItems[0].track as object);
            }
          }
        } else {
          const errText = await tracksRes.text().catch(() => "");
          debug.tracksEndpointError = errText.slice(0, 200);
        }
      } catch (e) {
        debug.tracksEndpointException = e instanceof Error ? e.message : String(e);
      }

      // Strategy 2: /playlists/{id} with market + fields
      try {
        const fullRes = await spotifyFetch(`/playlists/${playlistId}?market=FR&additional_types=track`);
        debug.fullEndpointStatus = fullRes.status;

        if (!fullRes.ok) {
          const text = await fullRes.text();
          debug.fullEndpointError = text.slice(0, 200);
          return NextResponse.json(
            { error: `Spotify ${fullRes.status}`, tracks: [], debug },
            { status: 200 },
          );
        }

        const data = await fullRes.json();
        debug.fullEndpointKeys = Object.keys(data);

        let rawItems: Record<string, unknown>[] = [];
        if (data.tracks && Array.isArray(data.tracks.items)) {
          rawItems = data.tracks.items;
          debug.tracksSource = "data.tracks.items";
        } else if (Array.isArray(data.tracks)) {
          rawItems = data.tracks;
          debug.tracksSource = "data.tracks (array)";
        } else if (Array.isArray(data.items)) {
          rawItems = data.items;
          debug.tracksSource = "data.items";
        } else {
          debug.tracksSource = "none found";
          debug.tracksType = data.tracks === undefined ? "undefined" : typeof data.tracks;
        }

        const tracks = rawItems
          .map((item) => item ? extractTrack(item) : null)
          .filter(Boolean);

        return NextResponse.json({
          tracks,
          total: data.tracks?.total || tracks.length,
          debug: { source: "full-object", rawItemCount: rawItems.length, ...debug },
        });
      } catch (e) {
        debug.fullEndpointException = e instanceof Error ? e.message : String(e);
      }

      return NextResponse.json({ tracks: [], debug });
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
