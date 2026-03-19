import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "fallback-secret-change-me");

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Portal routes - separate auth
  if (pathname.startsWith("/portal") || pathname.startsWith("/api/portal")) {
    // Public portal routes
    if (pathname === "/portal/login" || pathname === "/api/portal/auth") {
      return addSecurityHeaders(NextResponse.next());
    }

    // Verify portal JWT
    const portalToken = req.cookies.get("portal_token")?.value;
    if (!portalToken) {
      if (pathname.startsWith("/api/portal")) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/portal/login", req.url));
    }

    try {
      await jwtVerify(portalToken, SECRET);
      // If on login page with valid token, redirect to portal dashboard
      if (pathname === "/portal/login") {
        return NextResponse.redirect(new URL("/portal", req.url));
      }
      return addSecurityHeaders(NextResponse.next());
    } catch {
      if (pathname.startsWith("/api/portal")) {
        return NextResponse.json({ error: "Session expirée" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/portal/login", req.url));
    }
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

  // Allow public endpoints
  if (isApiAuth || isBranding || isCron) {
    return addSecurityHeaders(NextResponse.next());
  }

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return addSecurityHeaders(NextResponse.next());
});

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
