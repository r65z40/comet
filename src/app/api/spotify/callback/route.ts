import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCode, getRedirectUri, getSpotifyConfig } from "@/lib/spotify";

function getSettingsUrl(req: NextRequest, config: { redirectUri: string }): URL {
  if (config.redirectUri) {
    const origin = new URL(config.redirectUri).origin;
    return new URL("/settings", origin);
  }
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return new URL("/settings", `${forwardedProto || "https"}://${forwardedHost}`);
  }
  return new URL("/settings", req.url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  const config = await getSpotifyConfig();

  if (error || !code) {
    const base = getSettingsUrl(req, config);
    base.searchParams.set("spotify_error", error || "no_code");
    return NextResponse.redirect(base);
  }

  try {
    const redirectUri = getRedirectUri(req.url, req.headers, config);
    const tokens = await exchangeCode(code, redirectUri);
    const expires = Date.now() + tokens.expiresIn * 1000;

    await Promise.all([
      prisma.setting.upsert({
        where: { key: "spotify_access_token" },
        create: { key: "spotify_access_token", value: tokens.accessToken },
        update: { value: tokens.accessToken },
      }),
      prisma.setting.upsert({
        where: { key: "spotify_refresh_token" },
        create: { key: "spotify_refresh_token", value: tokens.refreshToken },
        update: { value: tokens.refreshToken },
      }),
      prisma.setting.upsert({
        where: { key: "spotify_token_expires" },
        create: { key: "spotify_token_expires", value: String(expires) },
        update: { value: String(expires) },
      }),
    ]);

    const base = getSettingsUrl(req, config);
    base.searchParams.set("spotify_connected", "true");
    return NextResponse.redirect(base);
  } catch (err) {
    const base = getSettingsUrl(req, config);
    base.searchParams.set("spotify_error", err instanceof Error ? err.message : "unknown");
    return NextResponse.redirect(base);
  }
}
