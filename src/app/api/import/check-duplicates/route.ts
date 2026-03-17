import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const body = await req.json();
    const { rows } = body as { rows: { client: string; product: string; invoice: string }[] };

    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    // Get unique client names and product names from import
    const clientNames = [...new Set(rows.map((r) => r.client).filter(Boolean))];
    const productNames = [...new Set(rows.map((r) => r.product).filter(Boolean))];
    const invoiceNumbers = [...new Set(rows.map((r) => r.invoice).filter(Boolean))];

    // Find existing clients
    const existingClients = clientNames.length > 0
      ? await prisma.client.findMany({
          where: { name: { in: clientNames, mode: "insensitive" } },
          select: { id: true, name: true },
        })
      : [];

    // Find existing products
    const existingProducts = productNames.length > 0
      ? await prisma.product.findMany({
          where: { name: { in: productNames, mode: "insensitive" } },
          select: { id: true, name: true },
        })
      : [];

    // Find existing invoices
    const existingInvoices = invoiceNumbers.length > 0
      ? await prisma.invoice.findMany({
          where: { invoiceNumber: { in: invoiceNumbers } },
          select: { id: true, invoiceNumber: true, client: { select: { name: true } } },
        })
      : [];

    // Find potential duplicate installations (same client + product + invoice)
    const clientNameMap = new Map(existingClients.map((c) => [c.name.toLowerCase(), c.id]));
    const duplicateInstallations: { line: number; client: string; product: string; invoice: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const clientId = clientNameMap.get(row.client?.toLowerCase());
      if (!clientId || !row.product) continue;

      const existingProduct = existingProducts.find(
        (p) => p.name.toLowerCase() === row.product.toLowerCase()
      );
      if (!existingProduct) continue;

      // Check if an installation already exists for this client + product + invoice
      const where: Record<string, unknown> = {
        clientId,
        productId: existingProduct.id,
      };

      if (row.invoice) {
        const inv = existingInvoices.find(
          (inv) => inv.invoiceNumber === row.invoice
        );
        if (inv) where.invoiceId = inv.id;
      }

      const existing = await prisma.installation.findFirst({
        where,
        select: { id: true },
      });

      if (existing) {
        duplicateInstallations.push({
          line: i + 2, // +2 for header row and 0-index
          client: row.client,
          product: row.product,
          invoice: row.invoice || "—",
        });
      }
    }

    return NextResponse.json({
      duplicates: duplicateInstallations,
      stats: {
        existingClients: existingClients.length,
        newClients: clientNames.length - existingClients.length,
        existingProducts: existingProducts.length,
        newProducts: productNames.length - existingProducts.length,
        existingInvoices: existingInvoices.length,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
