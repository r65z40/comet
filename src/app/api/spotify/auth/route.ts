import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSpotifyConfig, getAuthUrl, getRedirectUri } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const config = await getSpotifyConfig();
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.json({ error: "Spotify non configuré. Ajoutez Client ID et Secret dans les paramètres." }, { status: 400 });
  }

  const redirectUri = getRedirectUri(req.url, req.headers, config);

  // Store the user's current origin so the callback can redirect back
  const url = new URL(req.url);
  const returnOrigin = `${url.protocol}//${url.host}`;

  const authUrl = getAuthUrl(config.clientId, redirectUri, returnOrigin);

  return NextResponse.redirect(authUrl);
}
