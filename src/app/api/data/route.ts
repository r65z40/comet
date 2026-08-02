import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  try {
    const { types } = await req.json();

    if (!types || !Array.isArray(types) || types.length === 0) {
      return NextResponse.json({ error: "Aucun type de données sélectionné" }, { status: 400 });
    }

    const validTypes = ["installations", "invoices", "products", "clients"];
    const invalid = types.filter((t: string) => !validTypes.includes(t));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Types invalides: ${invalid.join(", ")}` }, { status: 400 });
    }

    const results: Record<string, number> = {};

    // Order matters due to foreign keys:
    // installations → invoiceLines → invoices → products → clients

    if (types.includes("installations")) {
      const { count } = await prisma.installation.deleteMany({});
      results.installations = count;
    }

    if (types.includes("invoices")) {
      // Delete invoice lines first
      const { count: linesCount } = await prisma.invoiceLine.deleteMany({});
      const { count } = await prisma.invoice.deleteMany({});
      results.invoices = count;
      results.invoice_lines = linesCount;
    }

    if (types.includes("products")) {
      // First remove product references from installations & invoice lines
      if (!types.includes("installations")) {
        await prisma.installation.deleteMany({});
        results.installations = (results.installations || 0);
      }
      if (!types.includes("invoices")) {
        await prisma.invoiceLine.deleteMany({});
        await prisma.invoice.deleteMany({});
      }
      const { count } = await prisma.product.deleteMany({});
      results.products = count;
    }

    if (types.includes("clients")) {
      // Cascade: must delete installations, invoices first
      if (!types.includes("installations")) {
        await prisma.installation.deleteMany({});
      }
      if (!types.includes("invoices")) {
        await prisma.invoiceLine.deleteMany({});
        await prisma.invoice.deleteMany({});
      }
      const { count } = await prisma.client.deleteMany({});
      results.clients = count;
    }

    return NextResponse.json({
      success: true,
      message: "Données supprimées avec succès",
      deleted: results,
    });
  } catch (err) {
    console.error("Data delete error:", err);
    return NextResponse.json({ error: "Erreur lors de la suppression des données" }, { status: 500 });
  }
}
