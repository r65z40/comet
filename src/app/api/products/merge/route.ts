import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  const { targetId, sourceId } = body;

  if (!targetId || !sourceId || targetId === sourceId) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  const [target, source] = await Promise.all([
    prisma.product.findUnique({ where: { id: targetId } }),
    prisma.product.findUnique({ where: { id: sourceId } }),
  ]);

  if (!target || !source) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  // Move all installations from source to target
  const installations = await prisma.installation.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });

  // Move all invoice lines from source to target
  const invoiceLines = await prisma.invoiceLine.updateMany({
    where: { productId: sourceId },
    data: { productId: targetId },
  });

  // Fill in missing info from source
  const updates: Record<string, unknown> = {};
  if (!target.description && source.description) updates.description = source.description;
  if (!target.family && source.family) updates.family = source.family;
  if (!target.supplier && source.supplier) updates.supplier = source.supplier;
  if (!target.code && source.code) updates.code = source.code;
  if (!target.unitPrice && source.unitPrice) updates.unitPrice = source.unitPrice;
  if (!target.durationMonths && source.durationMonths) updates.durationMonths = source.durationMonths;
  if (Object.keys(updates).length > 0) {
    await prisma.product.update({ where: { id: targetId }, data: updates });
  }

  // Delete the source product
  await prisma.product.delete({ where: { id: sourceId } });

  return NextResponse.json({
    success: true,
    message: `Produit "${source.name}" fusionné dans "${target.name}". ${installations.count} installation(s) et ${invoiceLines.count} ligne(s) de facture transférées.`,
  });
}
