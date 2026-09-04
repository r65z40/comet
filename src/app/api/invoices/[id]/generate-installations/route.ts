import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { include: { product: true } },
      installations: { where: { deletedAt: null }, select: { invoiceLineId: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
  }

  const installedLineIds = new Set(
    invoice.installations.map((i) => i.invoiceLineId).filter(Boolean)
  );

  let created = 0;

  for (const line of invoice.lines) {
    if (!line.product || installedLineIds.has(line.id)) continue;

    const softDeleted = await prisma.installation.findUnique({
      where: { invoiceLineId: line.id },
    });
    if (softDeleted) {
      await prisma.installation.delete({ where: { id: softDeleted.id } });
    }

    const duration =
      line.product.durationMonths && line.product.durationMonths > 0
        ? line.product.durationMonths
        : 12;
    const startDate = new Date(invoice.invoiceDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + duration);

    await prisma.installation.create({
      data: {
        clientId: invoice.clientId,
        productId: line.product.id,
        invoiceId: invoice.id,
        invoiceLineId: line.id,
        supplier: line.product.supplier || null,
        family: line.product.family || null,
        quantity: line.quantity,
        startDate,
        durationMonths: duration,
        endDate,
        status: "EN_PARC",
      },
    });
    created++;
  }

  return NextResponse.json({ created });
}
