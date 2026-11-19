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
    prisma.client.findUnique({ where: { id: targetId } }),
    prisma.client.findUnique({ where: { id: sourceId } }),
  ]);

  if (!target || !source) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const installations = await tx.installation.updateMany({
      where: { clientId: sourceId },
      data: { clientId: targetId },
    });

    const invoices = await tx.invoice.updateMany({
      where: { clientId: sourceId },
      data: { clientId: targetId },
    });

    if (!target.logoUrl && source.logoUrl) {
      await tx.client.update({
        where: { id: targetId },
        data: { logoUrl: source.logoUrl },
      });
    }

    const updates: Record<string, string> = {};
    if (!target.email && source.email) updates.email = source.email;
    if (!target.phone && source.phone) updates.phone = source.phone;
    if (!target.address && source.address) updates.address = source.address;
    if (!target.city && source.city) updates.city = source.city;
    if (!target.zipCode && source.zipCode) updates.zipCode = source.zipCode;
    if (Object.keys(updates).length > 0) {
      await tx.client.update({ where: { id: targetId }, data: updates });
    }

    await tx.client.delete({ where: { id: sourceId } });

    return { installationCount: installations.count, invoiceCount: invoices.count };
  });

  return NextResponse.json({
    success: true,
    message: `Client "${source.name}" fusionné dans "${target.name}". ${result.installationCount} installation(s) et ${result.invoiceCount} facture(s) transférées.`,
  });
}
