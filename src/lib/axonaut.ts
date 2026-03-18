import { prisma } from "@/lib/db";

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
    const PAGE_SIZE = 100;

    while (hasMore) {
      const data = await axonautFetch("/products", page);
      const products = Array.isArray(data) ? data : data.products || [];

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      for (const p of products) {
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
        totalSynced++;
      }

      await updateProgress(log.id, `Produits: ${totalSynced} synchronisés (page ${page})...`, totalSynced);

      if (products.length < PAGE_SIZE) {
        hasMore = false;
      }
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
    const PAGE_SIZE = 100;

    while (hasMore) {
      const data = await axonautFetch("/companies", page);
      const companies = Array.isArray(data) ? data : data.companies || [];

      if (companies.length === 0) {
        hasMore = false;
        break;
      }

      for (const c of companies) {
        // Determine client type from Axonaut flags (default to "client" if untyped)
        let clientType = "client";
        if (c.is_supplier || c.supplier) clientType = "fournisseur";
        else if (c.is_prospect || c.prospect) clientType = "prospect";

        await prisma.client.upsert({
          where: { axonautId: c.id },
          create: {
            axonautId: c.id,
            name: c.name || "Sans nom",
            email: c.email || null,
            phone: c.phone || null,
            address: c.address_street || null,
            city: c.address_city || null,
            zipCode: c.address_zip_code || null,
            country: c.address_country || null,
            clientType,
          },
          update: {
            name: c.name || "Sans nom",
            email: c.email || null,
            phone: c.phone || null,
            address: c.address_street || null,
            city: c.address_city || null,
            zipCode: c.address_zip_code || null,
            country: c.address_country || null,
            clientType,
          },
        });
        totalSynced++;
      }

      await updateProgress(log.id, `Clients: ${totalSynced} synchronisés (page ${page})...`, totalSynced);

      // Stop if this page had fewer items than the page size (last page)
      if (companies.length < PAGE_SIZE) {
        hasMore = false;
      }
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

export async function syncInvoices() {
  const log = await prisma.syncLog.create({
    data: { type: "invoices", status: "running", message: "Synchronisation des factures..." },
  });

  try {
    let page = 1;
    let totalSynced = 0;
    let hasMore = true;
    const PAGE_SIZE = 100;

    while (hasMore) {
      const data = await axonautFetch("/invoices", page);
      const invoices = Array.isArray(data) ? data : data.invoices || [];

      if (invoices.length === 0) {
        hasMore = false;
        break;
      }

      for (const inv of invoices) {
        // Try company_id, then company.id
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
            totalAmount: toFloat(inv.total_amount ?? inv.total),
            status: inv.status || null,
          },
          update: {
            invoiceNumber: inv.number || inv.invoice_number || null,
            clientId: client.id,
            invoiceDate: new Date(inv.date || inv.invoice_date || inv.created_at),
            totalAmount: toFloat(inv.total_amount ?? inv.total),
            status: inv.status || null,
          },
        });

        // Delete existing lines for this invoice before re-creating
        await prisma.invoiceLine.deleteMany({
          where: { invoiceId: invoice.id },
        });

        const lines = inv.lines || inv.invoice_lines || inv.products || [];
        for (const line of lines) {
          // Try multiple field names for product ID
          const lineProductId = line.product_id || line.productId || line.product?.id;
          let product = null;

          if (lineProductId) {
            product = await prisma.product.findUnique({ where: { axonautId: lineProductId } });
          }

          // Fallback: match by product name or code
          if (!product && (line.name || line.product_name || line.product_code)) {
            const searchName = line.name || line.product_name;
            const searchCode = line.product_code || line.code;

            if (searchCode) {
              product = await prisma.product.findFirst({ where: { code: searchCode } });
            }
            if (!product && searchName) {
              product = await prisma.product.findFirst({
                where: { name: { equals: searchName, mode: "insensitive" } },
              });
            }
          }

          await prisma.invoiceLine.create({
            data: {
              invoiceId: invoice.id,
              productId: product?.id || null,
              description: line.description || line.name || line.product_name || null,
              quantity: toFloat(line.quantity) ?? 1,
              unitPrice: toFloat(line.unit_price ?? line.price ?? line.unitPrice),
              totalPrice: toFloat(line.total_price ?? line.total ?? line.totalPrice),
            },
          });
        }

        totalSynced++;
      }

      await updateProgress(log.id, `Factures: ${totalSynced} synchronisées (page ${page})...`, totalSynced);

      if (invoices.length < PAGE_SIZE) {
        hasMore = false;
      }
      page++;
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        message: `${totalSynced} factures synchronisées`,
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
    data: { type: "installations", status: "running", message: "Génération des installations..." },
  });

  try {
    let totalGenerated = 0;
    let skippedNoProduct = 0;
    let skippedNoDuration = 0;
    let skippedNoClient = 0;
    let skippedExisting = 0;

    const invoiceLines = await prisma.invoiceLine.findMany({
      include: {
        invoice: { include: { client: true } },
        product: true,
      },
    });

    for (const line of invoiceLines) {
      if (!line.product) { skippedNoProduct++; continue; }
      if (!line.product.durationMonths || line.product.durationMonths <= 0) { skippedNoDuration++; continue; }
      if (!line.invoice?.client) { skippedNoClient++; continue; }

      // Vérifier si une installation existe déjà pour cette ligne de facture
      const existing = await prisma.installation.findUnique({
        where: { invoiceLineId: line.id },
      });

      if (existing) { skippedExisting++; continue; }

      const startDate = new Date(line.invoice.invoiceDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + line.product.durationMonths);

      const status = "EN_PARC";

      await prisma.installation.create({
        data: {
          clientId: line.invoice.clientId,
          productId: line.product.id,
          invoiceId: line.invoiceId,
          invoiceLineId: line.id,
          supplier: line.product.supplier,
          family: line.product.family,
          quantity: line.quantity,
          startDate,
          durationMonths: line.product.durationMonths,
          endDate,
          status,
        },
      });

      totalGenerated++;
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "success",
        message: `${totalGenerated} installations générées (${invoiceLines.length} lignes analysées, ${skippedNoProduct} sans produit lié, ${skippedNoDuration} sans durée, ${skippedNoClient} sans client, ${skippedExisting} déjà existantes)`,
        itemCount: totalGenerated,
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
  // Migrate old statuses to new ones
  await prisma.installation.updateMany({
    where: { status: "EN_PARC_GARANTIE" },
    data: { status: "EN_PARC" },
  });
  await prisma.installation.updateMany({
    where: { status: "EN_PARC_HORS_GARANTIE" },
    data: { status: "HORS_PARC" },
  });
}

export async function refreshClient(axonautId: number) {
  const c = await axonautFetchDirect(`/companies/${axonautId}`);
  let clientType = "client";
  if (c.is_supplier || c.supplier) clientType = "fournisseur";
  else if (c.is_prospect || c.prospect) clientType = "prospect";

  await prisma.client.upsert({
    where: { axonautId: c.id },
    create: {
      axonautId: c.id,
      name: c.name || "Sans nom",
      email: c.email || null,
      phone: c.phone || null,
      address: c.address_street || null,
      city: c.address_city || null,
      zipCode: c.address_zip_code || null,
      country: c.address_country || null,
      clientType,
    },
    update: {
      name: c.name || "Sans nom",
      email: c.email || null,
      phone: c.phone || null,
      address: c.address_street || null,
      city: c.address_city || null,
      zipCode: c.address_zip_code || null,
      country: c.address_country || null,
      clientType,
    },
  });

  return { success: true };
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
      totalAmount: toFloat(inv.total_amount ?? inv.total),
      status: inv.status || null,
    },
    update: {
      invoiceNumber: inv.number || inv.invoice_number || null,
      clientId: client.id,
      invoiceDate: new Date(inv.date || inv.invoice_date || inv.created_at),
      totalAmount: toFloat(inv.total_amount ?? inv.total),
      status: inv.status || null,
    },
  });

  // Re-create invoice lines
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } });

  const lines = inv.lines || inv.invoice_lines || inv.products || [];
  for (const line of lines) {
    const lineProductId = line.product_id || line.productId || line.product?.id;
    let product = null;

    if (lineProductId) {
      product = await prisma.product.findUnique({ where: { axonautId: lineProductId } });
    }

    if (!product && (line.name || line.product_name || line.product_code)) {
      const searchName = line.name || line.product_name;
      const searchCode = line.product_code || line.code;

      if (searchCode) {
        product = await prisma.product.findFirst({ where: { code: searchCode } });
      }
      if (!product && searchName) {
        product = await prisma.product.findFirst({
          where: { name: { equals: searchName, mode: "insensitive" } },
        });
      }
    }

    await prisma.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        productId: product?.id || null,
        description: line.description || line.name || line.product_name || null,
        quantity: toFloat(line.quantity) ?? 1,
        unitPrice: toFloat(line.unit_price ?? line.price ?? line.unitPrice),
        totalPrice: toFloat(line.total_price ?? line.total ?? line.totalPrice),
      },
    });
  }

  return { success: true };
}
