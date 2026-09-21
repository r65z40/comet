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
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
  }

  // Get lines that already have ANY installation (including soft-deleted) — skip those
  const allInstallations = await prisma.installation.findMany({
    where: { invoiceId: id },
    select: { invoiceLineId: true },
  });
  const processedLines = new Set(allInstallations.map((i) => i.invoiceLineId).filter(Boolean));

  let created = 0;

  for (const line of invoice.lines) {
    if (!line.product) continue;
    if (processedLines.has(line.id)) continue;

    const unitCount = Math.max(1, Math.round(line.quantity));

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
        quantity: unitCount,
        startDate,
        durationMonths: duration,
        endDate,
        status: "EN_PARC",
      },
    });
    created += unitCount;
  }

  return NextResponse.json({ created });
}
