import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

const PORTAL_COOKIE = "portal_token";
function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is required");
  return new TextEncoder().encode(secret);
}

interface PortalPayload {
  sub: string; // clientUser id
  clientId: string;
  email: string;
  name: string;
}

export async function createPortalToken(payload: PortalPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyPortalToken(): Promise<PortalPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PORTAL_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as PortalPayload;
  } catch {
    return null;
  }
}

export async function portalLogin(email: string, password: string): Promise<{ token: string; clientId: string } | null> {
  const clientUser = await prisma.clientUser.findUnique({
    where: { email },
  });

  if (!clientUser || !clientUser.active) return null;

  const valid = await bcrypt.compare(password, clientUser.password);
  if (!valid) return null;

  const token = await createPortalToken({
    sub: clientUser.id,
    clientId: clientUser.clientId,
    email: clientUser.email,
    name: clientUser.name,
  });

  return { token, clientId: clientUser.clientId };
}

export async function setPortalCookie(token: string) {
  const cookieStore = await cookies();
  const useSecureCookie = process.env.AUTH_URL?.startsWith("https") ?? process.env.NODE_ENV === "production";
  cookieStore.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: useSecureCookie,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
}

export async function clearPortalCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_COOKIE);
}
