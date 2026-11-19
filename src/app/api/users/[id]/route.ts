import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { validatePassword, passwordErrorMessage } from "@/lib/password";
import { logAudit } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  if (body.name) updateData.name = body.name;
  if (body.email) {
    const existing = await prisma.user.findFirst({
      where: { email: body.email, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
    updateData.email = body.email;
  }
  if (body.password) {
    const validation = validatePassword(body.password);
    if (!validation.valid) {
      return NextResponse.json({ error: passwordErrorMessage(validation) }, { status: 400 });
    }
    updateData.password = await bcrypt.hash(body.password, 10);
  }
  if (body.role && ["ADMIN", "USER"].includes(body.role)) {
    updateData.role = body.role;
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  await logAudit({
    userId: session.user.id,
    userName: session.user.name || session.user.email,
    action: "UPDATE",
    entity: "user",
    entityId: user.id,
    details: `Utilisateur ${user.name} (${user.email}) modifié — champs: ${Object.keys(updateData).join(", ")}`,
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  // Prevent deleting yourself
  if (session.user?.id === id) {
    return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true } });
  await prisma.user.delete({ where: { id } });

  await logAudit({
    userId: session.user.id,
    userName: session.user.name || session.user.email,
    action: "DELETE",
    entity: "user",
    entityId: id,
    details: `Utilisateur ${target?.name} (${target?.email}) supprimé`,
  });

  return NextResponse.json({ success: true });
}
