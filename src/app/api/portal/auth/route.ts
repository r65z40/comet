import { NextRequest, NextResponse } from "next/server";
import { portalLogin, setPortalCookie, clearPortalCookie } from "@/lib/portal-auth";

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

    await setPortalCookie(result.token);
    return NextResponse.json({ success: true, clientId: result.clientId });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE() {
  await clearPortalCookie();
  return NextResponse.json({ success: true });
}
