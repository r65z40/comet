import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Get all invoice line IDs that have an active (non-deleted) installation
  const activeInstallations = await prisma.installation.findMany({
    where: { invoiceLineId: { not: null }, deletedAt: null },
    select: { invoiceLineId: true },
  });
  const installedLineIds = new Set(activeInstallations.map((i) => i.invoiceLineId));

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

  // Filter to only lines without an active installation
  const missingLines = invoiceLines.filter((line) => !installedLineIds.has(line.id));

  // Group by invoice
  const invoiceMap = new Map<string, {
    id: string;
    invoiceNumber: string | null;
    invoiceDate: string;
    client: { id: string; name: string };
    lines: { id: string; productName: string; quantity: number; durationMonths: number | null }[];
  }>();

  for (const line of missingLines) {
    if (!line.invoice) continue;
    const inv = line.invoice;
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
      quantity: line.quantity,
      durationMonths: line.product?.durationMonths || null,
    });
  }

  const invoices = Array.from(invoiceMap.values());
  const totalMissing = missingLines.length;

  return NextResponse.json({ invoices, totalMissing });
}

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Get active installation line IDs
  const activeInstallations = await prisma.installation.findMany({
    where: { invoiceLineId: { not: null }, deletedAt: null },
    select: { invoiceLineId: true },
  });
  const installedLineIds = new Set(activeInstallations.map((i) => i.invoiceLineId));

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
    if (installedLineIds.has(line.id)) continue;

    try {
      // Remove soft-deleted installation if present (unique constraint)
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
      const startDate = new Date(line.invoice.invoiceDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + duration);

      await prisma.installation.create({
        data: {
          clientId: line.invoice.clientId,
          productId: line.product.id,
          invoiceId: line.invoice.id,
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
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ created, errors });
}
