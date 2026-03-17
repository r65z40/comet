import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (!type || !["installations", "clients", "products", "invoices"].includes(type)) {
    return NextResponse.json({ error: "Type d'export invalide. Valeurs: installations, clients, products, invoices" }, { status: 400 });
  }

  let csv = "";
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility

  if (type === "installations") {
    const installations = await prisma.installation.findMany({
      include: {
        client: { select: { name: true } },
        product: { select: { name: true, family: true } },
        invoice: { select: { invoiceNumber: true, invoiceDate: true } },
      },
      orderBy: { endDate: "asc" },
    });

    const headers = [
      "Client", "Produit", "Famille", "Fournisseur", "Quantité",
      "N° Facture", "Date Facturation", "Date Début", "Durée (mois)",
      "Date Fin Garantie", "Statut", "Toujours en parc", "Com Parc", "Notes",
    ];
    csv = headers.join(";") + "\n";

    for (const inst of installations) {
      csv += [
        escapeCSV(inst.client.name),
        escapeCSV(inst.product.name),
        escapeCSV(inst.family || inst.product.family),
        escapeCSV(inst.supplier),
        escapeCSV(inst.quantity),
        escapeCSV(inst.invoice?.invoiceNumber),
        escapeCSV(formatDate(inst.invoice?.invoiceDate ?? null)),
        escapeCSV(formatDate(inst.startDate)),
        escapeCSV(inst.durationMonths),
        escapeCSV(formatDate(inst.endDate)),
        escapeCSV(inst.status),
        escapeCSV(inst.alwaysInFleet ? "Oui" : "Non"),
        escapeCSV(inst.comParc),
        escapeCSV(inst.notes),
      ].join(";") + "\n";
    }
  }

  if (type === "clients") {
    const clients = await prisma.client.findMany({
      include: {
        _count: { select: { installations: true, invoices: true } },
      },
      orderBy: { name: "asc" },
    });

    const headers = ["Nom", "Email", "Téléphone", "Adresse", "Ville", "Code Postal", "Pays", "Type", "Nb Installations", "Nb Factures"];
    csv = headers.join(";") + "\n";

    for (const client of clients) {
      csv += [
        escapeCSV(client.name),
        escapeCSV(client.email),
        escapeCSV(client.phone),
        escapeCSV(client.address),
        escapeCSV(client.city),
        escapeCSV(client.zipCode),
        escapeCSV(client.country),
        escapeCSV(client.clientType),
        escapeCSV(client._count.installations),
        escapeCSV(client._count.invoices),
      ].join(";") + "\n";
    }
  }

  if (type === "products") {
    const products = await prisma.product.findMany({
      include: {
        _count: { select: { installations: true } },
      },
      orderBy: { name: "asc" },
    });

    const headers = ["Nom", "Code", "Description", "Famille", "Fournisseur", "Durée", "Durée (mois)", "Prix Unitaire", "Nb Installations"];
    csv = headers.join(";") + "\n";

    for (const product of products) {
      csv += [
        escapeCSV(product.name),
        escapeCSV(product.code),
        escapeCSV(product.description),
        escapeCSV(product.family),
        escapeCSV(product.supplier),
        escapeCSV(product.duration),
        escapeCSV(product.durationMonths),
        escapeCSV(product.unitPrice),
        escapeCSV(product._count.installations),
      ].join(";") + "\n";
    }
  }

  if (type === "invoices") {
    const invoices = await prisma.invoice.findMany({
      include: {
        client: { select: { name: true } },
        lines: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { invoiceDate: "desc" },
    });

    const headers = ["N° Facture", "Client", "Date Facturation", "Produit", "Description", "Quantité", "Prix Unitaire", "Prix Achat", "Total Ligne", "Statut"];
    csv = headers.join(";") + "\n";

    for (const inv of invoices) {
      if (inv.lines.length === 0) {
        csv += [
          escapeCSV(inv.invoiceNumber),
          escapeCSV(inv.client.name),
          escapeCSV(formatDate(inv.invoiceDate)),
          "", "", "", "", "", "",
          escapeCSV(inv.status),
        ].join(";") + "\n";
      } else {
        for (const line of inv.lines) {
          csv += [
            escapeCSV(inv.invoiceNumber),
            escapeCSV(inv.client.name),
            escapeCSV(formatDate(inv.invoiceDate)),
            escapeCSV(line.product?.name),
            escapeCSV(line.description),
            escapeCSV(line.quantity),
            escapeCSV(line.unitPrice),
            escapeCSV(line.purchasePrice),
            escapeCSV(line.totalPrice),
            escapeCSV(inv.status),
          ].join(";") + "\n";
        }
      }
    }
  }

  const filename = `export_${type}_${new Date().toISOString().split("T")[0]}.csv`;

  return new NextResponse(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
