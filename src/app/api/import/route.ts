import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function parseCSVLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try DD/MM/YYYY
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    if (day && month && year) {
      return new Date(year, month - 1, day);
    }
  }
  // Try YYYY-MM-DD
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

function parseFloat2(str: string): number | null {
  if (!str) return null;
  // Handle French number format: 1 613,00 -> 1613.00
  const cleaned = str.replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseBool(str: string): boolean {
  const lower = str.toLowerCase().trim();
  return lower === "vrai" || lower === "true" || lower === "oui" || lower === "1";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const separatorParam = (formData.get("separator") as string) || ";";

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    // Detect file encoding: Excel CSV exports from French Windows use
    // Windows-1252/Latin-1, not UTF-8. We must handle both.
    const rawBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(rawBuffer);

    let text: string;
    // Check for UTF-8 BOM (EF BB BF) — if present, it's definitely UTF-8
    const hasUtf8Bom = bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF;

    if (hasUtf8Bom) {
      text = new TextDecoder("utf-8").decode(bytes);
    } else {
      // No BOM: try strict UTF-8 decoding first
      let isValidUtf8 = true;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        isValidUtf8 = false;
        text = "";
      }

      if (!isValidUtf8) {
        // Not valid UTF-8 → decode as Latin-1 (covers all French accented chars)
        // Buffer.from().toString('latin1') is always available in Node.js
        text = Buffer.from(bytes).toString("latin1");
      }
    }
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      return NextResponse.json({ error: "Le fichier doit contenir au moins un en-tête et une ligne de données" }, { status: 400 });
    }

    const separator = separatorParam;
    const headers = parseCSVLine(lines[0], separator).map((h) =>
      h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, "_")
    );

    // Map column names to indices
    const colMap: Record<string, number> = {};
    const expectedColumns: Record<string, string[]> = {
      num_facture: ["num_facture", "numero_facture", "n°_facture", "facture"],
      date_facturation: ["date_facturation", "date_facture", "date"],
      client: ["client", "nom_client"],
      nom_produit: ["nom_produit", "nom_product", "produit", "product"],
      description: ["description", "desc"],
      quantite: ["quantité", "quantite", "qte", "qty"],
      prix_achat: ["prix_achat", "prix_d'achat", "cout", "coût", "cost"],
      prix_vente: ["prix_vente", "prix_de_vente", "prix", "price"],
      marge: ["marge", "margin"],
      famille_parc: ["famille_parc", "famille", "family"],
      echeance_garantie: ["echeance_garantie", "échéance_garantie", "echeance", "garantie", "warranty"],
      renouveler: ["renouveler", "renew", "renouvellement"],
      toujours_en_parc: ["toujours_en_parc", "en_parc", "in_park"],
      fournisseur: ["fournisseur", "supplier"],
    };

    for (const [key, aliases] of Object.entries(expectedColumns)) {
      for (const alias of aliases) {
        const idx = headers.indexOf(alias);
        if (idx !== -1) {
          colMap[key] = idx;
          break;
        }
      }
    }

    const results = {
      total: 0,
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCSVLine(lines[i], separator);
      if (fields.length < 3) continue;
      results.total++;

      const getValue = (key: string): string => {
        const idx = colMap[key];
        return idx !== undefined && idx < fields.length ? fields[idx].trim() : "";
      };

      try {
        const invoiceNumber = getValue("num_facture");
        const dateStr = getValue("date_facturation");
        const clientName = getValue("client");
        const productName = getValue("nom_produit");
        const description = getValue("description");
        const quantity = parseFloat2(getValue("quantite")) || 1;
        const purchasePrice = parseFloat2(getValue("prix_achat"));
        const salePrice = parseFloat2(getValue("prix_vente"));
        const family = getValue("famille_parc");
        const warrantyEndStr = getValue("echeance_garantie");
        const renew = parseBool(getValue("renouveler"));
        const inPark = parseBool(getValue("toujours_en_parc"));
        const supplier = getValue("fournisseur");

        if (!clientName) {
          results.errors.push(`Ligne ${i + 1}: Client manquant`);
          continue;
        }

        // Find or create client
        let client = await prisma.client.findFirst({
          where: { name: { equals: clientName, mode: "insensitive" } },
        });
        if (!client) {
          client = await prisma.client.create({
            data: { name: clientName },
          });
        }

        // Find or create product
        let product = null;
        if (productName) {
          product = await prisma.product.findFirst({
            where: { name: { equals: productName, mode: "insensitive" } },
          });
          if (!product) {
            product = await prisma.product.create({
              data: {
                name: productName,
                description: description || null,
                family: family || null,
                supplier: supplier || null,
                unitPrice: salePrice,
              },
            });
          }
        }

        // Find or create invoice
        const invoiceDate = parseDate(dateStr) || new Date();
        let invoice = null;
        if (invoiceNumber) {
          invoice = await prisma.invoice.findFirst({
            where: { invoiceNumber, clientId: client.id },
          });
          if (!invoice) {
            invoice = await prisma.invoice.create({
              data: {
                invoiceNumber,
                clientId: client.id,
                invoiceDate,
                status: "PAYEE",
              },
            });
          }
        } else {
          invoice = await prisma.invoice.create({
            data: {
              clientId: client.id,
              invoiceDate,
              status: "PAYEE",
            },
          });
        }

        // Create invoice line
        const invoiceLine = await prisma.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            productId: product?.id || null,
            description: description || productName || null,
            quantity,
            unitPrice: salePrice,
            purchasePrice,
            totalPrice: salePrice ? salePrice * quantity : null,
          },
        });

        // Create installation if we have warranty info
        const warrantyEnd = parseDate(warrantyEndStr);
        if (product && warrantyEnd) {
          const startDate = invoiceDate;
          const durationMonths = Math.max(
            1,
            Math.round((warrantyEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
          );

          let status = "EN_PARC_GARANTIE";
          if (renew) {
            status = "RENOUVELE";
          } else if (!inPark) {
            status = "HORS_PARC";
          } else if (warrantyEnd < new Date()) {
            status = "EN_PARC_HORS_GARANTIE";
          }

          await prisma.installation.create({
            data: {
              clientId: client.id,
              productId: product.id,
              invoiceId: invoice.id,
              invoiceLineId: invoiceLine.id,
              supplier: supplier || null,
              family: family || null,
              quantity,
              startDate,
              durationMonths,
              endDate: warrantyEnd,
              status,
            },
          });
        }

        results.created++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Ligne ${i + 1}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import terminé: ${results.created} lignes importées sur ${results.total}`,
      ...results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erreur d'import: ${msg}` }, { status: 500 });
  }
}
