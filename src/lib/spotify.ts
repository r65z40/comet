import { prisma } from "@/lib/db";

const SPOTIFY_ACCOUNTS_URL = "https://accounts.spotify.com";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

const SETTING_KEYS = [
  "spotify_client_id",
  "spotify_client_secret",
  "spotify_access_token",
  "spotify_refresh_token",
  "spotify_token_expires",
  "spotify_redirect_uri",
];

export { SETTING_KEYS as SPOTIFY_SETTING_KEYS };

interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpires: number;
  redirectUri: string;
}

export async function getSpotifyConfig(): Promise<SpotifyConfig> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: SETTING_KEYS } },
  });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  return {
    clientId: map.spotify_client_id || "",
    clientSecret: map.spotify_client_secret || "",
    accessToken: map.spotify_access_token || "",
    refreshToken: map.spotify_refresh_token || "",
    tokenExpires: parseInt(map.spotify_token_expires || "0"),
    redirectUri: map.spotify_redirect_uri || "",
  };
}

export function getRedirectUri(requestUrl: string, headers?: Headers, config?: SpotifyConfig): string {
  if (config?.redirectUri) {
    return config.redirectUri;
  }

  const forwardedHost = headers?.get("x-forwarded-host");
  const forwardedProto = headers?.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto || "https"}://${forwardedHost}/api/spotify/callback`;
  }

  const host = headers?.get("host");
  if (host && forwardedProto) {
    return `${forwardedProto}://${host}/api/spotify/callback`;
  }

  const url = new URL(requestUrl);
  return `${url.protocol}//${url.host}/api/spotify/callback`;
}

export function getAuthUrl(clientId: string, redirectUri: string, returnOrigin?: string): string {
  const scopes = [
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
  ].join(" ");

  const state = Buffer.from(JSON.stringify({ origin: returnOrigin || "" })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });

  return `${SPOTIFY_ACCOUNTS_URL}/authorize?${params}`;
}

export function parseState(stateParam: string | null): { origin: string } {
  if (!stateParam) return { origin: "" };
  try {
    return JSON.parse(Buffer.from(stateParam, "base64url").toString());
  } catch {
    return { origin: "" };
  }
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const config = await getSpotifyConfig();
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const res = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshAccessToken(): Promise<string> {
  const config = await getSpotifyConfig();
  if (!config.refreshToken) throw new Error("No refresh token");

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  const res = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    }),
  });

  if (!res.ok) throw new Error("Failed to refresh Spotify token");

  const data = await res.json();
  const expires = Date.now() + data.expires_in * 1000;

  await prisma.setting.upsert({
    where: { key: "spotify_access_token" },
    create: { key: "spotify_access_token", value: data.access_token },
    update: { value: data.access_token },
  });
  await prisma.setting.upsert({
    where: { key: "spotify_token_expires" },
    create: { key: "spotify_token_expires", value: String(expires) },
    update: { value: String(expires) },
  });
  if (data.refresh_token) {
    await prisma.setting.upsert({
      where: { key: "spotify_refresh_token" },
      create: { key: "spotify_refresh_token", value: data.refresh_token },
      update: { value: data.refresh_token },
    });
  }

  return data.access_token;
}

export async function getValidToken(): Promise<string> {
  const config = await getSpotifyConfig();
  if (!config.accessToken) throw new Error("Not connected to Spotify");

  if (Date.now() > config.tokenExpires - 60000) {
    return refreshAccessToken();
  }

  return config.accessToken;
}

export async function spotifyFetch(endpoint: string, options?: RequestInit) {
  const token = await getValidToken();
  const res = await fetch(`${SPOTIFY_API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  return res;
}

export async function searchTracks(query: string, limit = 10) {
  const params = new URLSearchParams({ q: query, type: "track,playlist,album", limit: String(limit) });
  const res = await spotifyFetch(`/search?${params}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export async function getUserPlaylists(limit = 50) {
  const res = await spotifyFetch(`/me/playlists?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch playlists");
  return res.json();
}

export async function getPlaylistTracks(playlistId: string, limit = 50) {
  const res = await spotifyFetch(`/playlists/${playlistId}/tracks?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch playlist tracks");
  return res.json();
}

export async function getFeaturedPlaylists(limit = 20) {
  const res = await spotifyFetch(`/browse/featured-playlists?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch featured playlists");
  return res.json();
}

export async function getRecentlyPlayed(limit = 20) {
  const res = await spotifyFetch(`/me/player/recently-played?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch recently played");
  return res.json();
}
