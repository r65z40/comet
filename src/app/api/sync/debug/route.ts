import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// Endpoint de diagnostic pour débugger la sync
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    // Compter les éléments en base
    const [
      productsTotal,
      productsWithDuration,
      clientsTotal,
      invoicesTotal,
      invoiceLinesTotal,
      invoiceLinesWithProduct,
      invoiceLinesWithoutProduct,
      installationsTotal,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { durationMonths: { not: null, gt: 0 } } }),
      prisma.client.count(),
      prisma.invoice.count(),
      prisma.invoiceLine.count(),
      prisma.invoiceLine.count({ where: { productId: { not: null } } }),
      prisma.invoiceLine.count({ where: { productId: null } }),
      prisma.installation.count(),
    ]);

    // Exemples de produits avec durée
    const sampleProductsWithDuration = await prisma.product.findMany({
      where: { durationMonths: { not: null, gt: 0 } },
      select: { id: true, name: true, durationMonths: true, duration: true, family: true, supplier: true },
      take: 5,
    });

    // Exemples de produits sans durée
    const sampleProductsWithoutDuration = await prisma.product.findMany({
      where: { OR: [{ durationMonths: null }, { durationMonths: 0 }] },
      select: { id: true, name: true, durationMonths: true, duration: true, family: true },
      take: 5,
    });

    // Exemples de lignes de factures sans produit lié
    const sampleOrphanLines = await prisma.invoiceLine.findMany({
      where: { productId: null },
      select: { id: true, description: true, quantity: true, unitPrice: true },
      take: 5,
    });

    // Exemples de lignes avec produit mais sans durée
    const sampleLinesNoDuration = await prisma.invoiceLine.findMany({
      where: {
        productId: { not: null },
        product: { OR: [{ durationMonths: null }, { durationMonths: 0 }] },
      },
      select: {
        id: true,
        description: true,
        product: { select: { name: true, durationMonths: true, duration: true } },
      },
      take: 5,
    });

    // Tester la connexion Axonaut et voir la structure des données
    let axonautSample = null;
    try {
      const apiKey = await prisma.setting.findUnique({ where: { key: "axonaut_api_key" } });
      const apiUrl = await prisma.setting.findUnique({ where: { key: "axonaut_api_url" } });
      const key = apiKey?.value || process.env.AXONAUT_API_KEY;
      const url = apiUrl?.value || process.env.AXONAUT_API_URL || "https://axonaut.com/api/v2";

      if (key) {
        // Récupérer 1 produit pour voir la structure
        const prodRes = await fetch(`${url}/products?page=1`, {
          headers: { userApiKey: key, "Content-Type": "application/json" },
        });
        const prodData = await prodRes.json();
        const products = Array.isArray(prodData) ? prodData : prodData.products || [];
        const sampleProduct = products[0] || null;

        // Récupérer 1 facture pour voir la structure
        const invRes = await fetch(`${url}/invoices?page=1`, {
          headers: { userApiKey: key, "Content-Type": "application/json" },
        });
        const invData = await invRes.json();
        const invoices = Array.isArray(invData) ? invData : invData.invoices || [];
        const sampleInvoice = invoices[0] || null;

        axonautSample = {
          productKeys: sampleProduct ? Object.keys(sampleProduct) : [],
          productCustomFields: sampleProduct?.custom_fields,
          productSample: sampleProduct ? {
            id: sampleProduct.id,
            name: sampleProduct.name,
            code: sampleProduct.code,
            custom_fields: sampleProduct.custom_fields,
          } : null,
          invoiceKeys: sampleInvoice ? Object.keys(sampleInvoice) : [],
          invoiceLinesKey: sampleInvoice
            ? (sampleInvoice.lines ? "lines" : sampleInvoice.invoice_lines ? "invoice_lines" : sampleInvoice.products ? "products" : "AUCUNE CLÉ TROUVÉE")
            : null,
          invoiceSample: sampleInvoice ? {
            id: sampleInvoice.id,
            number: sampleInvoice.number,
            company_id: sampleInvoice.company_id,
            company: sampleInvoice.company,
            date: sampleInvoice.date,
            linesCount: (sampleInvoice.lines || sampleInvoice.invoice_lines || sampleInvoice.products || []).length,
            firstLine: (sampleInvoice.lines || sampleInvoice.invoice_lines || sampleInvoice.products || [])[0] || null,
          } : null,
        };
      }
    } catch (e) {
      axonautSample = { error: e instanceof Error ? e.message : "Erreur" };
    }

    return NextResponse.json({
      database: {
        products: { total: productsTotal, withDuration: productsWithDuration, withoutDuration: productsTotal - productsWithDuration },
        clients: { total: clientsTotal },
        invoices: { total: invoicesTotal },
        invoiceLines: { total: invoiceLinesTotal, withProduct: invoiceLinesWithProduct, withoutProduct: invoiceLinesWithoutProduct },
        installations: { total: installationsTotal },
      },
      samples: {
        productsWithDuration: sampleProductsWithDuration,
        productsWithoutDuration: sampleProductsWithoutDuration,
        orphanLines: sampleOrphanLines,
        linesNoDuration: sampleLinesNoDuration,
      },
      axonautApiStructure: axonautSample,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur" },
      { status: 500 }
    );
  }
}
