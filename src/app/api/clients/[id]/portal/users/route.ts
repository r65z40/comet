import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// POST - create a portal user for a client
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const { name, email, password } = await req.json();

  if (!name || !email) {
    return NextResponse.json({ error: "Nom et email requis" }, { status: 400 });
  }

  // Check email uniqueness
  const existing = await prisma.clientUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
  }

  // Password is optional - if not provided, user will set it via invite link
  const data: { clientId: string; name: string; email: string; password?: string } = { clientId: id, name, email };
  if (password) {
    if (password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
    }
    data.password = await bcrypt.hash(password, 10);
  }

  const user = await prisma.clientUser.create({
    data,
    select: { id: true, name: true, email: true, active: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
