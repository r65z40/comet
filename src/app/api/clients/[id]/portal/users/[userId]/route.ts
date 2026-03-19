import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// PATCH - update a portal user (toggle active, reset password)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { userId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.name === "string" && body.name) data.name = body.name;
  if (typeof body.email === "string" && body.email) {
    const existing = await prisma.clientUser.findUnique({ where: { email: body.email } });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
    data.email = body.email;
  }
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
    }
    data.password = await bcrypt.hash(body.password, 10);
  }

  const user = await prisma.clientUser.update({
    where: { id: userId },
    data,
    select: { id: true, name: true, email: true, active: true, createdAt: true },
  });

  return NextResponse.json(user);
}

// DELETE - remove a portal user
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { userId } = await params;
  await prisma.clientUser.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
