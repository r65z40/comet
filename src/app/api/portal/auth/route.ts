import { NextRequest, NextResponse } from "next/server";
import { portalLogin } from "@/lib/portal-auth";

const PORTAL_COOKIE = "portal_token";

function buildSetCookie(name: string, value: string, maxAge: number): string {
  const parts = [
    `${name}=${value}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis" }, { status: 400 });
    }

    const result = await portalLogin(email, password);
    if (!result) {
      return NextResponse.json({ error: "Identifiants incorrects" }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, clientId: result.clientId });
    response.headers.append(
      "Set-Cookie",
      buildSetCookie(PORTAL_COOKIE, result.token, 60 * 60 * 24 * 7)
    );
    return response;
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.headers.append(
    "Set-Cookie",
    `${PORTAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return response;
}
