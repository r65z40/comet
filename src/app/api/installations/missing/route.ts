import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Find lines that have ANY installation (including soft-deleted) — those are already processed
  const allInstallations = await prisma.installation.findMany({
    where: { invoiceLineId: { not: null } },
    select: { invoiceLineId: true },
  });
  const processedLines = new Set(allInstallations.map((i) => i.invoiceLineId).filter(Boolean));

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

  // Filter to lines that have never had an installation created
  const missingLines = invoiceLines.filter((line) => {
    return !processedLines.has(line.id);
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
    totalMissing += unitCount;

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
      installed: 0,
      durationMonths: line.product?.durationMonths || null,
    });
  }

  const invoices = Array.from(invoiceMap.values());

  return NextResponse.json({ invoices, totalMissing });
}

export async function POST() {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Find lines that already have ANY installation (including soft-deleted)
  const allInstallations = await prisma.installation.findMany({
    where: { invoiceLineId: { not: null } },
    select: { invoiceLineId: true },
  });
  const processedLines = new Set(allInstallations.map((i) => i.invoiceLineId).filter(Boolean));

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
    if (processedLines.has(line.id)) continue;

    const unitCount = Math.max(1, Math.round(line.quantity));

    try {
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
          quantity: unitCount,
          startDate,
          durationMonths: duration,
          endDate,
          status: "EN_PARC",
        },
      });
      created += unitCount;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ created, errors });
}
