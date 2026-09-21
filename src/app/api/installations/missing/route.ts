import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Sum existing quantities per line (not row count) to handle installations with quantity > 1
  const activeInstallations = await prisma.installation.findMany({
    where: { invoiceLineId: { not: null }, deletedAt: null },
    select: { invoiceLineId: true, quantity: true },
  });
  const installCountByLine = new Map<string, number>();
  for (const inst of activeInstallations) {
    if (inst.invoiceLineId) {
      installCountByLine.set(inst.invoiceLineId, (installCountByLine.get(inst.invoiceLineId) || 0) + (inst.quantity || 1));
    }
  }

  // Get all invoice lines with a product
  const invoiceLines = await prisma.invoiceLine.findMany({
    where: { productId: { not: null } },
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          client: { select: { id: true, name: true } },
        },
      },
      product: { select: { id: true, name: true, durationMonths: true } },
    },
    orderBy: { invoice: { invoiceDate: "desc" } },
  });

  // Filter to lines where installed count < required unit count
  const missingLines = invoiceLines.filter((line) => {
    const unitCount = Math.max(1, Math.round(line.quantity));
    const installed = installCountByLine.get(line.id) || 0;
    return installed < unitCount;
  });

  // Group by invoice
  const invoiceMap = new Map<string, {
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    client: { id: string; name: string };
    lines: { id: string; productName: string; quantity: number; installed: number; durationMonths: number | null }[];
  }>();

  let totalMissing = 0;

  for (const line of missingLines) {
    if (!line.invoice) continue;
    const inv = line.invoice;
    const unitCount = Math.max(1, Math.round(line.quantity));
    const installed = installCountByLine.get(line.id) || 0;
    const missing = unitCount - installed;
    totalMissing += missing;

    if (!invoiceMap.has(inv.id)) {
      invoiceMap.set(inv.id, {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString(),
        client: inv.client,
        lines: [],
      });
    }
    invoiceMap.get(inv.id)!.lines.push({
      id: line.id,
      productName: line.product?.name || "—",
      quantity: unitCount,
      installed,
      durationMonths: line.product?.durationMonths || null,
    });
  }

  const invoices = Array.from(invoiceMap.values());

  return NextResponse.json({ invoices, totalMissing });
}

export async function POST() {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Sum existing quantities per line (not row count) to handle installations with quantity > 1
  const activeInstallations = await prisma.installation.findMany({
    where: { invoiceLineId: { not: null }, deletedAt: null },
    select: { invoiceLineId: true, quantity: true },
  });
  const installCountByLine = new Map<string, number>();
  for (const inst of activeInstallations) {
    if (inst.invoiceLineId) {
      installCountByLine.set(inst.invoiceLineId, (installCountByLine.get(inst.invoiceLineId) || 0) + (inst.quantity || 1));
    }
  }

  // Get all invoice lines with products
  const invoiceLines = await prisma.invoiceLine.findMany({
    where: { productId: { not: null } },
    include: {
      invoice: true,
      product: true,
    },
  });

  let created = 0;
  let errors = 0;

  for (const line of invoiceLines) {
    if (!line.product || !line.invoice) continue;

    const unitCount = Math.max(1, Math.round(line.quantity));
    const existingCount = installCountByLine.get(line.id) || 0;
    if (existingCount >= unitCount) continue;

    try {
      // Remove soft-deleted installations for this line
      await prisma.installation.deleteMany({
        where: { invoiceLineId: line.id, deletedAt: { not: null } },
      });

      const duration =
        line.product.durationMonths && line.product.durationMonths > 0
          ? line.product.durationMonths
          : 12;
      const startDate = new Date(line.invoice.invoiceDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + duration);

      const remaining = unitCount - existingCount;
      if (remaining > 0) {
        await prisma.installation.create({
          data: {
            clientId: line.invoice.clientId,
            productId: line.product.id,
            invoiceId: line.invoice.id,
            invoiceLineId: line.id,
            supplier: line.product.supplier || null,
            family: line.product.family || null,
            quantity: remaining,
            startDate,
            durationMonths: duration,
            endDate,
            status: "EN_PARC",
          },
        });
        created += remaining;
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ created, errors });
}
