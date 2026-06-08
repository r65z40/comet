import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id, deletedAt: null },
    include: {
      installations: {
        where: { deletedAt: null },
        include: {
          client: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true } },
        },
        orderBy: { endDate: "asc" },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Produit non trouvé" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id }, select: { name: true } });

  // Soft delete: mark product and its installations as deleted
  await prisma.installation.updateMany({ where: { productId: id }, data: { deletedAt: new Date() } });
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: session.user?.id,
    userName: session.user?.name || session.user?.email,
    action: "DELETE",
    entity: "product",
    entityId: id,
    details: product?.name || null,
  });

  return NextResponse.json({ success: true });
}
