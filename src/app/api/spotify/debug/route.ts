import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSpotifyConfig, getValidToken, spotifyFetch } from "@/lib/spotify";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const config = await getSpotifyConfig();
  const debug: Record<string, unknown> = {
    hasClientId: !!config.clientId,
    hasClientSecret: !!config.clientSecret,
    hasAccessToken: !!config.accessToken,
    hasRefreshToken: !!config.refreshToken,
    tokenExpires: config.tokenExpires,
    tokenExpired: Date.now() > config.tokenExpires,
    redirectUri: config.redirectUri,
  };

  try {
    const token = await getValidToken();
    debug.tokenValid = true;
    debug.tokenPreview = token.slice(0, 10) + "...";

    // Test: get user profile (basic scope)
    const profileRes = await spotifyFetch("/me");
    if (profileRes.ok) {
      const profile = await profileRes.json();
      debug.user = profile.display_name;
      debug.product = profile.product; // "premium" or "free"
      debug.country = profile.country;
    } else {
      debug.profileError = `${profileRes.status}: ${await profileRes.text()}`;
    }

    // Test: get playlists
    const playlistRes = await spotifyFetch("/me/playlists?limit=3");
    if (playlistRes.ok) {
      const data = await playlistRes.json();
      debug.playlistCount = data.total;
      debug.firstPlaylists = (data.items || []).map((p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
      }));
    } else {
      debug.playlistError = `${playlistRes.status}: ${await playlistRes.text()}`;
    }

    // Test: get first playlist tracks (via /playlists/{id} to avoid 403)
    if (debug.firstPlaylists && (debug.firstPlaylists as { id: string }[]).length > 0) {
      const firstId = (debug.firstPlaylists as { id: string }[])[0].id;
      const tracksRes = await spotifyFetch(`/playlists/${firstId}`);
      if (tracksRes.ok) {
        const data = await tracksRes.json();
        debug.firstPlaylistTrackCount = data.tracks?.total;
        debug.firstPlaylistTracks = (data.tracks?.items || []).slice(0, 3).map((item: Record<string, unknown>) => {
          const track = item.track as Record<string, unknown> | null;
          return track ? { name: track.name, id: track.id } : "null track";
        });
      } else {
        debug.tracksError = `${tracksRes.status}: ${await tracksRes.text()}`;
      }
    }

    // Test: devices
    const devicesRes = await spotifyFetch("/me/player/devices");
    if (devicesRes.ok) {
      const data = await devicesRes.json();
      debug.devices = (data.devices || []).map((d: Record<string, unknown>) => ({
        name: d.name,
        type: d.type,
        active: d.is_active,
      }));
    } else {
      debug.devicesError = `${devicesRes.status}: ${await devicesRes.text()}`;
    }

  } catch (err) {
    debug.tokenValid = false;
    debug.error = err instanceof Error ? err.message : "Unknown error";
  }

  return NextResponse.json(debug);
}
