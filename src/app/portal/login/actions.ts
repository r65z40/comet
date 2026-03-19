"use server";

import { cookies } from "next/headers";
import { portalLogin } from "@/lib/portal-auth";

export async function portalLoginAction(email: string, password: string) {
  if (!email || !password) {
    return { error: "Email et mot de passe requis" };
  }

  const result = await portalLogin(email, password);
  if (!result) {
    return { error: "Identifiants incorrects" };
  }

  const cookieStore = await cookies();
  cookieStore.set("portal_token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return { success: true, clientId: result.clientId };
}
