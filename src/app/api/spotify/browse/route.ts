import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getFeaturedPlaylists,
  getRecentlyPlayed,
  getTopArtists,
  getTopTracks,
  getNewReleases,
  getUserPlaylists,
} from "@/lib/spotify";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const [featured, recent, topArt, topTrk, newRel, userPl] = await Promise.allSettled([
      getFeaturedPlaylists(20),
      getRecentlyPlayed(20),
      getTopArtists(20),
      getTopTracks(20),
      getNewReleases(20),
      getUserPlaylists(20),
    ]);

    const featuredPlaylists =
      featured.status === "fulfilled"
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

    const recentTracks =
      recent.status === "fulfilled"
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
              album: album?.name || "",
              image: images[0]?.url || images[images.length - 1]?.url || "",
              durationMs: t.duration_ms,
            };
          })
        : [];

    const topArtists =
      topArt.status === "fulfilled"
        ? (topArt.value.items || []).map((a: Record<string, unknown>) => {
            const images = (a.images || []) as { url: string }[];
            const genres = (a.genres || []) as string[];
            return {
              id: a.id,
              name: a.name,
              image: images[0]?.url || "",
              uri: a.uri,
              genres: genres.slice(0, 2),
            };
          })
        : [];

    const topTracks =
      topTrk.status === "fulfilled"
        ? (topTrk.value.items || []).map((t: Record<string, unknown>) => {
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
          })
        : [];

    const newReleases =
      newRel.status === "fulfilled"
        ? (newRel.value.albums?.items || []).map((a: Record<string, unknown>) => {
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
            };
          })
        : [];

    const userPlaylists =
      userPl.status === "fulfilled"
        ? (userPl.value.items || []).map((p: Record<string, unknown>) => {
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
          })
        : [];

    return NextResponse.json({
      featuredPlaylists,
      recentTracks,
      topArtists,
      topTracks,
      newReleases,
      userPlaylists,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
