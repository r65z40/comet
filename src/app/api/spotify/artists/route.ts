import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spotifyFetch } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const artistId = req.nextUrl.searchParams.get("id");
  if (!artistId) return NextResponse.json({ error: "Missing artist id" }, { status: 400 });

  try {
    const [artistRes, tracksRes, albumsRes, relatedRes] = await Promise.allSettled([
      spotifyFetch(`/artists/${artistId}`),
      spotifyFetch(`/artists/${artistId}/top-tracks?market=FR`),
      spotifyFetch(`/artists/${artistId}/albums?limit=20&include_groups=album,single`),
      spotifyFetch(`/artists/${artistId}/related-artists`),
    ]);

    let artist = null;
    if (artistRes.status === "fulfilled" && artistRes.value.ok) {
      const a = await artistRes.value.json();
      const images = (a.images || []) as { url: string }[];
      artist = {
        id: a.id,
        name: a.name,
        image: images[0]?.url || "",
        uri: a.uri,
        genres: (a.genres || []) as string[],
        followers: a.followers?.total || 0,
      };
    }

    let topTracks: Record<string, unknown>[] = [];
    if (tracksRes.status === "fulfilled" && tracksRes.value.ok) {
      const data = await tracksRes.value.json();
      topTracks = (data.tracks || []).map((t: Record<string, unknown>) => {
        const album = t.album as Record<string, unknown> | undefined;
        const images = (album?.images || []) as { url: string }[];
        const artists = (t.artists || []) as { name: string }[];
        return {
          id: t.id,
          uri: t.uri,
          name: t.name,
          artist: artists.map((ar) => ar.name).join(", "),
          album: album?.name || "",
          image: images[0]?.url || images[images.length - 1]?.url || "",
          durationMs: t.duration_ms,
        };
      });
    }

    let albums: Record<string, unknown>[] = [];
    if (albumsRes.status === "fulfilled" && albumsRes.value.ok) {
      const data = await albumsRes.value.json();
      albums = (data.items || []).map((a: Record<string, unknown>) => {
        const images = (a.images || []) as { url: string }[];
        const artists = (a.artists || []) as { name: string }[];
        return {
          id: a.id,
          name: a.name,
          artist: artists.map((ar) => ar.name).join(", "),
          image: images[0]?.url || "",
          uri: a.uri,
          releaseDate: a.release_date || "",
          totalTracks: a.total_tracks || 0,
          albumType: a.album_type || "album",
        };
      });
    }

    let relatedArtists: Record<string, unknown>[] = [];
    if (relatedRes.status === "fulfilled" && relatedRes.value.ok) {
      const data = await relatedRes.value.json();
      relatedArtists = (data.artists || []).slice(0, 10).map((a: Record<string, unknown>) => {
        const images = (a.images || []) as { url: string }[];
        return {
          id: a.id,
          name: a.name,
          image: images[0]?.url || "",
          uri: a.uri,
        };
      });
    }

    return NextResponse.json({ artist, topTracks, albums, relatedArtists });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
