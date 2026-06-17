import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

function buildUrl(path: string, req: NextRequest): URL {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return new URL(path, `${forwardedProto || "https"}://${forwardedHost}`);
  }
  return new URL(path, req.url);
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Portal routes use their own auth (JWT verified in API routes & layout)
  if (pathname.startsWith("/portal") || pathname.startsWith("/api/portal")) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Admin/dashboard routes - NextAuth
  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname === "/login";
  const isAuthPage = pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/signout";
  const isApiAuth = pathname.startsWith("/api/auth");
  const isBranding = pathname === "/api/branding";
  const isCron = pathname === "/api/cron";
  const isHealth = pathname === "/api/health";
  const isSpotifyCallback = pathname === "/api/spotify/callback";

  // Allow public endpoints
  if (isApiAuth || isBranding || isCron || isHealth || isSpotifyCallback) {
    return addSecurityHeaders(NextResponse.next());
  }

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(buildUrl("/login", req));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(buildUrl("/dashboard", req));
  }

  return addSecurityHeaders(NextResponse.next());
});

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
