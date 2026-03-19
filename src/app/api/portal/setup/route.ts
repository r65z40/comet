import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// GET - validate an invitation token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 });
  }

  const user = await prisma.clientUser.findUnique({
    where: { inviteToken: token },
    select: { id: true, name: true, email: true, inviteTokenExpiry: true, client: { select: { name: true } } },
  });

  if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Lien d'invitation invalide ou expiré" }, { status: 400 });
  }

  return NextResponse.json({ name: user.name, email: user.email, clientName: user.client.name });
}

// POST - set password and activate account
export async function POST(req: NextRequest) {
  const { token, password, name } = await req.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Token et mot de passe requis" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
  }

  const user = await prisma.clientUser.findUnique({
    where: { inviteToken: token },
  });

  if (!user || !user.inviteTokenExpiry || user.inviteTokenExpiry < new Date()) {
    return NextResponse.json({ error: "Lien d'invitation invalide ou expiré" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.clientUser.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      name: name || user.name,
      active: true,
      inviteToken: null,
      inviteTokenExpiry: null,
    },
  });

  return NextResponse.json({ success: true });
}
