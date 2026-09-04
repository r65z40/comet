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

  // Count existing active installations per line
  const installCountByLine = new Map<string, number>();
  for (const inst of invoice.installations) {
    if (inst.invoiceLineId) {
      installCountByLine.set(inst.invoiceLineId, (installCountByLine.get(inst.invoiceLineId) || 0) + 1);
    }
  }

  let created = 0;

  for (const line of invoice.lines) {
    if (!line.product) continue;

    const unitCount = Math.max(1, Math.round(line.quantity));
    const existingCount = installCountByLine.get(line.id) || 0;
    if (existingCount >= unitCount) continue;

    // Remove soft-deleted installations for this line
    await prisma.installation.deleteMany({
      where: { invoiceLineId: line.id, deletedAt: { not: null } },
    });

    const duration =
      line.product.durationMonths && line.product.durationMonths > 0
        ? line.product.durationMonths
        : 12;
    const startDate = new Date(invoice.invoiceDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + duration);

    const toCreate = unitCount - existingCount;
    for (let i = 0; i < toCreate; i++) {
      await prisma.installation.create({
        data: {
          clientId: invoice.clientId,
          productId: line.product.id,
          invoiceId: invoice.id,
          invoiceLineId: line.id,
          supplier: line.product.supplier || null,
          family: line.product.family || null,
          quantity: 1,
          startDate,
          durationMonths: duration,
          endDate,
          status: "EN_PARC",
        },
      });
      created++;
    }
  }

  return NextResponse.json({ created });
}
