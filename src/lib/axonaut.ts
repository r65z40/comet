import { prisma } from "@/lib/db";

function axonautImportDetails() {
  return `Sync Axonaut — ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

async function getAxonautConfig() {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["axonaut_api_key", "axonaut_api_url"] } },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return {
    apiKey: map.axonaut_api_key || process.env.AXONAUT_API_KEY || "",
    apiUrl: map.axonaut_api_url || process.env.AXONAUT_API_URL || "https://axonaut.com/api/v2",
  };
}

// Délai entre les appels API pour éviter les 429
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let lastApiCall = 0;
const API_DELAY_MS = 600; // 600ms entre chaque appel

async function rateLimitedFetch(url: string, apiKey: string): Promise<Response> {
  // Rate limiting: attendre entre les appels
  const now = Date.now();
  const elapsed = now - lastApiCall;
  if (elapsed < API_DELAY_MS) {
    await delay(API_DELAY_MS - elapsed);
  }
  lastApiCall = Date.now();

  const res = await fetch(url, {
    headers: { "userApiKey": apiKey, "Content-Type": "application/json" },
    cache: "no-store",
  });

  // Retry avec backoff exponentiel en cas de 429
  if (res.status === 429) {
    for (const wait of [2000, 4000, 8000]) {
      await delay(wait);
      lastApiCall = Date.now();
      const retry = await fetch(url, {
        headers: { "userApiKey": apiKey, "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (retry.status !== 429) return retry;
    }
    throw new Error("Axonaut API: trop de requêtes (429). Réessayez dans quelques minutes.");
  }

  return res;
}

async function axonautFetch(endpoint: string, page = 1) {
  const { apiKey, apiUrl } = await getAxonautConfig();
  if (!apiKey) throw new Error("Clé API Axonaut non configurée");

  const url = `${apiUrl}${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page}`;
  const res = await rateLimitedFetch(url, apiKey);

  if (!res.ok) {
    throw new Error(`Axonaut API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

async function axonautFetchDirect(endpoint: string) {
  const { apiKey, apiUrl } = await getAxonautConfig();
  if (!apiKey) throw new Error("Clé API Axonaut non configurée");

  const url = `${apiUrl}${endpoint}`;
  const res = await rateLimitedFetch(url, apiKey);

  if (!res.ok) {
    throw new Error(`Axonaut API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

function toFloat(val: unknown): number | null {
  if (val == null) return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

// custom_fields peut être:
// - un objet: {"Durée en mois": "12", "Famille": "Réseau"}
// - un tableau: [{name: "Durée en mois", value: "12"}, ...]
// - un tableau avec label/value: [{label: "Durée en mois", value: "12"}, ...]
function getCustomField(customFields: unknown, fieldName: string): string | null {
  if (!customFields) return null;

  if (typeof customFields === "object" && !Array.isArray(customFields)) {
    const obj = customFields as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key === fieldName || norm(key) === norm(fieldName)) {
        return obj[key] != null ? String(obj[key]) : null;
      }
    }
    return null;
  }

  if (Array.isArray(customFields)) {
    for (const field of customFields) {
      const name = field.name || field.label || field.key || "";
      if (name === fieldName || norm(name) === norm(fieldName)) {
        return field.value != null ? String(field.value) : null;
      }
    }
    return null;
  }

  return null;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

// Update sync log with progress (throttled to avoid DB spam)
async function updateProgress(logId: string, message: string, itemCount: number) {
  await prisma.syncLog.update({
    where: { id: logId },
    data: { message, itemCount },
  });
}

// Mark stale "running" logs (older than 5 minutes) as error
export async function cleanupStaleLogs() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.syncLog.updateMany({
    where: {
      status: "running",
      startedAt: { lt: fiveMinutesAgo },
    },
    data: {
      status: "error",
      message: "Synchronisation interrompue (timeout)",
      completedAt: new Date(),
    },
  });
}

export async function syncProducts() {
  const log = await prisma.syncLog.create({
    data: { type: "products", status: "running", message: "Synchronisation des produits..." },
  });

  try {
    let page = 1;
    let totalSynced = 0;
    let hasMore = true;
    const seenIds = new Set<number>();

    while (hasMore) {
      const data = await axonautFetch("/products", page);
      const products = Array.isArray(data) ? data : data.products || [];

      if (products.length === 0) break;

      let newOnThisPage = 0;
      for (const p of products) {
        if (seenIds.has(p.id)) continue;
        seenIds.add(p.id);
        newOnThisPage++;

        try {
          const cf = p.custom_fields;
          const durationStr = getCustomField(cf, "Durée en mois") || getCustomField(cf, "Duree en mois");
          const durationMonths = durationStr ? parseInt(durationStr, 10) : 0;
          const family = getCustomField(cf, "Famille") || p.category || null;
          const supplier = getCustomField(cf, "Fournisseur") || null;
          const duration = getCustomField(cf, "Durée") || getCustomField(cf, "Duree") || null;

          const existingProductByAxonaut = await prisma.product.findUnique({ where: { axonautId: p.id } });

          if (existingProductByAxonaut) {
            await prisma.product.update({
              where: { id: existingProductByAxonaut.id },
              data: {
                name: p.name || "Sans nom",
                code: p.code || null,
                description: p.description || null,
                family,
                supplier,
                duration,
                durationMonths: durationMonths || null,
                unitPrice: toFloat(p.price),
              },
            });
          } else {
            const existingProductByName = await prisma.product.findFirst({
              where: {
                name: { equals: p.name || "Sans nom", mode: "insensitive" },
                axonautId: null,
              },
            });

            if (existingProductByName) {
              await prisma.product.update({
                where: { id: existingProductByName.id },
                data: {
                  axonautId: p.id,
                  name: p.name || "Sans nom",
                  code: p.code || null,
                  description: p.description || null,
                  family,
                  supplier,
                  duration,
                  durationMonths: durationMonths || null,
                  unitPrice: toFloat(p.price),
                },
              });
            } else {
              await prisma.product.create({
                data: {
                  axonautId: p.id,
                  name: p.name || "Sans nom",
                  code: p.code || null,
                  description: p.description || null,
                  family,
                  supplier,
                  duration,
                  durationMonths: durationMonths || null,
                  unitPrice: toFloat(p.price),
                  importSource: "axonaut",
                  importDetails: axonautImportDetails(),
                },
              });
            }
          }
          totalSynced++;
        } catch {
          // Continue with next product
        }
      }

      await updateProgress(log.id, `Produits: ${totalSynced} synchronisés (page ${page})...`, totalSynced);

      if (newOnThisPage === 0) break;
      page++;
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        message: `${totalSynced} produits synchronisés`,
        itemCount: totalSynced,
        completedAt: new Date(),
      },
    });

    return { success: true, count: totalSynced };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function syncClients() {
  const log = await prisma.syncLog.create({
    data: { type: "clients", status: "running", message: "Synchronisation des clients..." },
  });

  try {
    let page = 1;
    let totalSynced = 0;
    let hasMore = true;
    const seenIds = new Set<number>();

    while (hasMore) {
      const data = await axonautFetch("/companies", page);
      const companies = Array.isArray(data) ? data : data.companies || [];

      if (companies.length === 0) break;

      let newOnThisPage = 0;
      for (const c of companies) {
        if (seenIds.has(c.id)) continue;
        seenIds.add(c.id);
        newOnThisPage++;

        try {
          let clientType = "client";
          if (c.is_supplier || c.supplier) clientType = "fournisseur";
          else if (c.is_prospect || c.prospect) clientType = "prospect";

          const clientData = {
            name: c.name || "Sans nom",
            email: c.email || null,
            phone: c.phone || null,
            mobile: c.cellphone_number || c.mobile || null,
            fax: c.fax || null,
            website: c.website || c.url || null,
            siret: c.siret || c.registration_number || null,
            address: c.address_street || null,
            addressComplement: c.address_complement || c.address_street_2 || null,
            city: c.address_city || null,
            zipCode: c.address_zip_code || null,
            country: c.address_country || null,
            clientType,
            notes: c.notes || c.comments || null,
          };

          const existingByAxonaut = await prisma.client.findUnique({ where: { axonautId: c.id } });

          if (existingByAxonaut) {
            await prisma.client.update({
              where: { id: existingByAxonaut.id },
              data: clientData,
            });
          } else {
            const existingByName = await prisma.client.findFirst({
              where: {
                name: { equals: c.name || "Sans nom", mode: "insensitive" },
                axonautId: null,
              },
            });

            if (existingByName) {
              await prisma.client.update({
                where: { id: existingByName.id },
                data: { axonautId: c.id, ...clientData },
              });
            } else {
              await prisma.client.create({
                data: { axonautId: c.id, ...clientData, importSource: "axonaut", importDetails: axonautImportDetails() },
              });
            }
          }
          totalSynced++;
        } catch {
          // Continue with next client
        }
      }

      await updateProgress(log.id, `Clients: ${totalSynced} synchronisés (page ${page})...`, totalSynced);

      if (newOnThisPage === 0) break;
      page++;
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        message: `${totalSynced} clients synchronisés`,
        itemCount: totalSynced,
        completedAt: new Date(),
      },
    });

    return { success: true, count: totalSynced };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function syncContacts() {
  const log = await prisma.syncLog.create({
    data: { type: "contacts", status: "running", message: "Synchronisation des contacts..." },
  });

  try {
    let page = 1;
    let totalSynced = 0;
    let hasMore = true;
    const seenIds = new Set<number>();

    while (hasMore) {
      const data = await axonautFetch("/employees", page);
      const employees = Array.isArray(data) ? data : data.employees || [];

      if (employees.length === 0) break;

      let newOnThisPage = 0;
      for (const emp of employees) {
        if (seenIds.has(emp.id)) continue;
        seenIds.add(emp.id);
        newOnThisPage++;

        try {
          const companyId = emp.company_id || emp.company?.id;
          if (!companyId) continue;

          const client = await prisma.client.findUnique({ where: { axonautId: companyId } });
          if (!client) continue;

          const contactData = {
            clientId: client.id,
            firstName: emp.firstname || emp.first_name || null,
            lastName: emp.lastname || emp.last_name || null,
            email: emp.email || null,
            phone: emp.phone_number || emp.phone || null,
            mobile: emp.cellphone_number || emp.mobile || null,
            jobTitle: emp.job || emp.job_title || null,
            isBillingContact: emp.is_billing_contact || false,
          };

          const existingContact = await prisma.contact.findUnique({ where: { axonautId: emp.id } });

          if (existingContact) {
            await prisma.contact.update({
              where: { id: existingContact.id },
              data: contactData,
            });
          } else {
            await prisma.contact.create({
              data: { axonautId: emp.id, ...contactData, importSource: "axonaut", importDetails: axonautImportDetails() },
            });
          }
          totalSynced++;
        } catch {
          // Continue with next contact
        }
      }

      await updateProgress(log.id, `Contacts: ${totalSynced} synchronisés (page ${page})...`, totalSynced);

      if (newOnThisPage === 0) break;
      page++;
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        message: `${totalSynced} contacts synchronisés`,
        itemCount: totalSynced,
        completedAt: new Date(),
      },
    });

    return { success: true, count: totalSynced };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function resolveProduct(line: Record<string, unknown>): Promise<{ id: string; name: string; supplier: string | null; family: string | null; durationMonths: number | null } | null> {
  const lineProductId = line.product_id || line.productId || (line.product as Record<string, unknown>)?.id;
  if (lineProductId) {
    const p = await prisma.product.findUnique({
      where: { axonautId: lineProductId as number },
      select: { id: true, name: true, supplier: true, family: true, durationMonths: true },
    });
    if (p) return p;
  }

  const searchName = (line.name || line.product_name) as string | undefined;
  const searchCode = (line.product_code || line.code) as string | undefined;

  if (searchCode) {
    const p = await prisma.product.findFirst({
      where: { code: searchCode },
      select: { id: true, name: true, supplier: true, family: true, durationMonths: true },
    });
    if (p) return p;
  }
  if (searchName) {
    const p = await prisma.product.findFirst({
      where: { name: { equals: searchName, mode: "insensitive" } },
      select: { id: true, name: true, supplier: true, family: true, durationMonths: true },
    });
    if (p) return p;
  }
  return null;
}

async function upsertInvoiceLines(
  invoiceId: string,
  incomingLines: Record<string, unknown>[],
): Promise<{ lineId: string; product: Awaited<ReturnType<typeof resolveProduct>>; quantity: number; isNew: boolean }[]> {
  const existingLines = await prisma.invoiceLine.findMany({
    where: { invoiceId },
    orderBy: { createdAt: "asc" },
  });

  const results: { lineId: string; product: Awaited<ReturnType<typeof resolveProduct>>; quantity: number; isNew: boolean }[] = [];
  const usedExistingIds = new Set<string>();

  for (let i = 0; i < incomingLines.length; i++) {
    const line = incomingLines[i];
    const product = await resolveProduct(line);
    const description = (line.description || line.name || line.product_name || null) as string | null;
    const quantity = toFloat(line.quantity) ?? 1;
    let unitPrice = toFloat(line.unit_price ?? line.price ?? line.unitPrice ?? line.product_sale_price ?? line.sale_price);
    let totalPrice = toFloat(line.total_pre_tax_amount ?? line.total_price ?? line.total ?? line.totalPrice ?? line.total_amount ?? line.amount ?? line.pre_tax_amount);

    if (unitPrice != null && totalPrice == null && quantity > 0) {
      totalPrice = unitPrice * quantity;
    } else if (totalPrice != null && unitPrice == null && quantity > 0) {
      unitPrice = totalPrice / quantity;
    }

    // Match existing line by position (index) — stable across re-syncs
    const match = existingLines[i] && !usedExistingIds.has(existingLines[i].id) ? existingLines[i] : null;

    if (match) {
      usedExistingIds.add(match.id);
      await prisma.invoiceLine.update({
        where: { id: match.id },
        data: {
          productId: product?.id || null,
          description,
          quantity,
          unitPrice,
          totalPrice,
          importDetails: axonautImportDetails(),
        },
      });
      results.push({ lineId: match.id, product, quantity, isNew: false });
    } else {
      const created = await prisma.invoiceLine.create({
        data: {
          invoiceId,
          productId: product?.id || null,
          description,
          quantity,
          unitPrice,
          totalPrice,
          importSource: "axonaut",
          importDetails: axonautImportDetails(),
        },
      });
      results.push({ lineId: created.id, product, quantity, isNew: true });
    }
  }

  // Delete extra lines that no longer exist in Axonaut (only if they have no linked installation)
  for (const existing of existingLines) {
    if (!usedExistingIds.has(existing.id)) {
      const hasInstallation = await prisma.installation.findUnique({ where: { invoiceLineId: existing.id } });
      if (!hasInstallation) {
        await prisma.invoiceLine.delete({ where: { id: existing.id } });
      }
    }
  }

  return results;
}

async function generateInstallationForLine(
  lineId: string,
  invoiceId: string,
  clientId: string,
  invoiceDate: Date,
  product: NonNullable<Awaited<ReturnType<typeof resolveProduct>>>,
  quantity: number,
): Promise<"created" | "merged" | "skipped"> {
  if (!product.durationMonths || product.durationMonths <= 0) return "skipped";

  const existing = await prisma.installation.findUnique({ where: { invoiceLineId: lineId } });
  if (existing) return "skipped";

  const startDate = new Date(invoiceDate);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + product.durationMonths);

  // Search for an orphan installation to re-link
  const normStr = (s: string | null | undefined) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const startMin = new Date(startDate); startMin.setDate(startMin.getDate() - 3);
  const startMax = new Date(startDate); startMax.setDate(startMax.getDate() + 3);
  const endMin = new Date(endDate); endMin.setDate(endMin.getDate() - 3);
  const endMax = new Date(endDate); endMax.setDate(endMax.getDate() + 3);

  const orphanCandidates = await prisma.installation.findMany({
    where: {
      clientId,
      invoiceLineId: null,
      deletedAt: null,
      startDate: { gte: startMin, lte: startMax },
      endDate: { gte: endMin, lte: endMax },
    },
    include: { product: { select: { name: true, supplier: true } } },
  });

  const productNameNorm = normStr(product.name);
  const productSupplierNorm = normStr(product.supplier);
  const orphan = orphanCandidates.find(
    (o) =>
      normStr(o.product.name) === productNameNorm &&
      normStr(o.product.supplier) === productSupplierNorm &&
      Math.abs(o.quantity - quantity) < 0.0001,
  );

  if (orphan) {
    await prisma.installation.update({
      where: { id: orphan.id },
      data: {
        invoiceId,
        invoiceLineId: lineId,
        supplier: product.supplier ?? orphan.supplier,
        family: product.family ?? orphan.family,
        quantity,
      },
    });
    return "merged";
  }

  await prisma.installation.create({
    data: {
      clientId,
      productId: product.id,
      invoiceId,
      invoiceLineId: lineId,
      supplier: product.supplier,
      family: product.family,
      quantity,
      startDate,
      durationMonths: product.durationMonths,
      endDate,
      status: "EN_PARC",
      importSource: "axonaut",
      importDetails: axonautImportDetails(),
    },
  });
  return "created";
}

export async function syncInvoices() {
  const log = await prisma.syncLog.create({
    data: { type: "invoices", status: "running", message: "Synchronisation des factures + installations..." },
  });

  try {
    let page = 1;
    let totalSynced = 0;
    let totalInstCreated = 0;
    let totalInstMerged = 0;
    let errors = 0;
    let hasMore = true;
    const seenIds = new Set<number>();

    while (hasMore) {
      const data = await axonautFetch("/invoices", page);
      const invoices = Array.isArray(data) ? data : data.invoices || [];

      if (invoices.length === 0) break;

      let newOnThisPage = 0;
      for (const inv of invoices) {
        if (seenIds.has(inv.id)) continue;
        seenIds.add(inv.id);
        newOnThisPage++;
        try {
          const companyId = inv.company_id || inv.company?.id;
          const client = companyId
            ? await prisma.client.findUnique({ where: { axonautId: companyId } })
            : null;

          if (!client) continue;

          const invoice = await prisma.invoice.upsert({
            where: { axonautId: inv.id },
            create: {
              axonautId: inv.id,
              invoiceNumber: inv.number || inv.invoice_number || null,
              clientId: client.id,
              invoiceDate: new Date(inv.date || inv.invoice_date || inv.created_at),
              totalAmount: toFloat(inv.total ?? inv.total_amount ?? inv.pre_tax_amount),
              status: inv.status || null,
              importSource: "axonaut",
              importDetails: axonautImportDetails(),
            },
            update: {
              invoiceNumber: inv.number || inv.invoice_number || null,
              clientId: client.id,
              invoiceDate: new Date(inv.date || inv.invoice_date || inv.created_at),
              totalAmount: toFloat(inv.total ?? inv.total_amount ?? inv.pre_tax_amount),
              status: inv.status || null,
            },
          });

          const incomingLines = inv.lines || inv.invoice_lines || inv.products || [];
          const lineResults = await upsertInvoiceLines(invoice.id, incomingLines);

          // Generate installations for each line that has a product with duration
          for (const lr of lineResults) {
            if (!lr.product) continue;
            const result = await generateInstallationForLine(
              lr.lineId,
              invoice.id,
              client.id,
              new Date(inv.date || inv.invoice_date || inv.created_at),
              lr.product,
              lr.quantity,
            );
            if (result === "created") totalInstCreated++;
            if (result === "merged") totalInstMerged++;
          }

          totalSynced++;
        } catch {
          errors++;
        }
      }

      await updateProgress(log.id, `Factures: ${totalSynced} sync, ${totalInstCreated} inst. créées (page ${page})...`, totalSynced);

      if (newOnThisPage === 0) break;
      page++;
    }

    const parts = [`${totalSynced} factures synchronisées`];
    if (totalInstCreated > 0) parts.push(`${totalInstCreated} installations créées`);
    if (totalInstMerged > 0) parts.push(`${totalInstMerged} installations fusionnées`);
    if (errors > 0) parts.push(`${errors} erreurs`);

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: errors > 0 && totalSynced === 0 ? "error" : "success",
        message: parts.join(", "),
        itemCount: totalSynced,
        completedAt: new Date(),
      },
    });

    return { success: true, count: totalSynced };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function generateInstallations() {
  const log = await prisma.syncLog.create({
    data: { type: "installations", status: "running", message: "Génération des installations manquantes..." },
  });

  try {
    let totalGenerated = 0;
    let totalMerged = 0;
    let skipped = 0;

    const invoiceLines = await prisma.invoiceLine.findMany({
      include: {
        invoice: { include: { client: true } },
        product: true,
      },
    });

    for (const line of invoiceLines) {
      if (!line.product || !line.product.durationMonths || line.product.durationMonths <= 0 || !line.invoice?.client) {
        skipped++;
        continue;
      }

      const result = await generateInstallationForLine(
        line.id,
        line.invoiceId,
        line.invoice.clientId,
        line.invoice.invoiceDate,
        line.product,
        line.quantity,
      );
      if (result === "created") totalGenerated++;
      else if (result === "merged") totalMerged++;
      else skipped++;
    }

    const parts = [`${totalGenerated} installations créées`];
    if (totalMerged > 0) parts.push(`${totalMerged} fusionnées`);
    parts.push(`${invoiceLines.length} lignes analysées, ${skipped} ignorées`);

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        message: parts.join(", "),
        itemCount: totalGenerated + totalMerged,
        completedAt: new Date(),
      },
    });

    return { success: true, count: totalGenerated };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Erreur inconnue",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function updateInstallationStatuses() {
  // No-op: status changes are manual only
}

export async function refreshClient(axonautId: number) {
  const c = await axonautFetchDirect(`/companies/${axonautId}`);
  let clientType = "client";
  if (c.is_supplier || c.supplier) clientType = "fournisseur";
  else if (c.is_prospect || c.prospect) clientType = "prospect";

  const clientData = {
    name: c.name || "Sans nom",
    email: c.email || null,
    phone: c.phone || null,
    mobile: c.cellphone_number || c.mobile || null,
    fax: c.fax || null,
    website: c.website || c.url || null,
    siret: c.siret || c.registration_number || null,
    address: c.address_street || null,
    addressComplement: c.address_complement || c.address_street_2 || null,
    city: c.address_city || null,
    zipCode: c.address_zip_code || null,
    country: c.address_country || null,
    clientType,
    notes: c.notes || c.comments || null,
  };

  // Check if already linked by axonautId
  const existingByAxonaut = await prisma.client.findUnique({ where: { axonautId: c.id } });

  let clientId: string;
  if (existingByAxonaut) {
    await prisma.client.update({ where: { id: existingByAxonaut.id }, data: clientData });
    clientId = existingByAxonaut.id;
  } else {
    const existingByName = await prisma.client.findFirst({
      where: { name: { equals: c.name || "Sans nom", mode: "insensitive" }, axonautId: null },
    });

    if (existingByName) {
      await prisma.client.update({
        where: { id: existingByName.id },
        data: { axonautId: c.id, ...clientData },
      });
      clientId = existingByName.id;
    } else {
      const created = await prisma.client.create({ data: { axonautId: c.id, ...clientData, importSource: "axonaut", importDetails: axonautImportDetails() } });
      clientId = created.id;
    }
  }

  // Also refresh contacts for this company
  await refreshClientContacts(axonautId, clientId);

  return { success: true };
}

async function refreshClientContacts(companyAxonautId: number, clientId: string) {
  try {
    // Fetch employees linked to this company from Axonaut
    const data = await axonautFetchDirect(`/companies/${companyAxonautId}/employees`);
    const employees = Array.isArray(data) ? data : data.employees || [];

    // Get existing contacts for this client
    const existingContacts = await prisma.contact.findMany({ where: { clientId } });
    const existingAxonautIds = new Set(existingContacts.filter(c => c.axonautId).map(c => c.axonautId));
    const seenAxonautIds = new Set<number>();

    for (const emp of employees) {
      if (!emp.id) continue;
      seenAxonautIds.add(emp.id);

      const contactData = {
        clientId,
        firstName: emp.firstname || emp.first_name || null,
        lastName: emp.lastname || emp.last_name || null,
        email: emp.email || null,
        phone: emp.phone_number || emp.phone || null,
        mobile: emp.cellphone_number || emp.mobile || null,
        jobTitle: emp.job || emp.job_title || null,
        isBillingContact: emp.is_billing_contact || false,
      };

      if (existingAxonautIds.has(emp.id)) {
        await prisma.contact.update({
          where: { axonautId: emp.id },
          data: contactData,
        });
      } else {
        await prisma.contact.create({
          data: { axonautId: emp.id, ...contactData, importSource: "axonaut", importDetails: axonautImportDetails() },
        });
      }
    }

    // Remove contacts that no longer exist in Axonaut
    for (const existing of existingContacts) {
      if (existing.axonautId && !seenAxonautIds.has(existing.axonautId)) {
        await prisma.contact.delete({ where: { id: existing.id } });
      }
    }
  } catch {
    // If the employees endpoint fails (404 etc.), silently skip contacts sync
  }
}

export async function refreshProduct(axonautId: number) {
  const p = await axonautFetchDirect(`/products/${axonautId}`);
  const cf = p.custom_fields;
  const durationStr = getCustomField(cf, "Durée en mois") || getCustomField(cf, "Duree en mois");
  const durationMonths = durationStr ? parseInt(durationStr, 10) : 0;
  const family = getCustomField(cf, "Famille") || p.category || null;
  const supplier = getCustomField(cf, "Fournisseur") || null;
  const duration = getCustomField(cf, "Durée") || getCustomField(cf, "Duree") || null;

  await prisma.product.upsert({
    where: { axonautId: p.id },
    create: {
      axonautId: p.id,
      name: p.name || "Sans nom",
      code: p.code || null,
      description: p.description || null,
      family,
      supplier,
      duration,
      durationMonths: durationMonths || null,
      unitPrice: toFloat(p.price),
      importSource: "axonaut",
      importDetails: axonautImportDetails(),
    },
    update: {
      name: p.name || "Sans nom",
      code: p.code || null,
      description: p.description || null,
      family,
      supplier,
      duration,
      durationMonths: durationMonths || null,
      unitPrice: toFloat(p.price),
    },
  });

  return { success: true };
}

export async function refreshInvoice(axonautId: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let inv: any = null;

  // Try direct endpoint first (handles both wrapped and unwrapped responses)
  try {
    const data = await axonautFetchDirect(`/invoices/${axonautId}`);
    // Handle both { id: ... } and { invoice: { id: ... } } response formats
    if (data && data.id) {
      inv = data;
    } else if (data && data.invoice && data.invoice.id) {
      inv = data.invoice;
    }
  } catch {
    // Direct endpoint failed (404, etc.) - will try paginated search
  }

  if (!inv) {
    // Fallback: paginated search with a reasonable limit
    for (let page = 1; page <= 50; page++) {
      const data = await axonautFetch("/invoices", page);
      const invoices = Array.isArray(data) ? data : data.invoices || [];
      if (invoices.length === 0) break;
      const found = invoices.find((i: { id: number }) => i.id === axonautId);
      if (found) { inv = found; break; }
    }
  }

  if (!inv) {
    throw new Error(
      `Facture Axonaut #${axonautId} introuvable via l'API. ` +
      `Essayez d'abord une synchronisation complète des factures depuis la page Synchronisation.`
    );
  }

  const companyId = inv.company_id || inv.company?.id;
  const client = companyId
    ? await prisma.client.findUnique({ where: { axonautId: companyId } })
    : null;

  if (!client) throw new Error("Client non trouvé pour cette facture. Synchronisez d'abord les clients.");

  const invoice = await prisma.invoice.upsert({
    where: { axonautId: inv.id },
    create: {
      axonautId: inv.id,
      invoiceNumber: inv.number || inv.invoice_number || null,
      clientId: client.id,
      invoiceDate: new Date(inv.date || inv.invoice_date || inv.created_at),
      totalAmount: toFloat(inv.total ?? inv.total_amount ?? inv.pre_tax_amount),
      status: inv.status || null,
      importSource: "axonaut",
      importDetails: axonautImportDetails(),
    },
    update: {
      invoiceNumber: inv.number || inv.invoice_number || null,
      clientId: client.id,
      invoiceDate: new Date(inv.date || inv.invoice_date || inv.created_at),
      totalAmount: toFloat(inv.total ?? inv.total_amount ?? inv.pre_tax_amount),
      status: inv.status || null,
    },
  });

  const incomingLines = inv.lines || inv.invoice_lines || inv.products || [];
  const lineResults = await upsertInvoiceLines(invoice.id, incomingLines);

  for (const lr of lineResults) {
    if (!lr.product) continue;
    await generateInstallationForLine(
      lr.lineId,
      invoice.id,
      client.id,
      new Date(inv.date || inv.invoice_date || inv.created_at),
      lr.product,
      lr.quantity,
    );
  }

  return { success: true };
}
