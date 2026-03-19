import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

// POST - generate an invitation token for a portal user
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id, userId } = await params;

  const user = await prisma.clientUser.findFirst({
    where: { id: userId, clientId: id },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.clientUser.update({
    where: { id: userId },
    data: { inviteToken: token, inviteTokenExpiry: expiry },
  });

  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const inviteUrl = `${origin}/portal/setup?token=${token}`;

  return NextResponse.json({ inviteUrl, expiresAt: expiry.toISOString() });
}
