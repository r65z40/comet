import { prisma } from "@/lib/db";

async function getAxonautConfig() {
  const apiKey = await prisma.setting.findUnique({ where: { key: "axonaut_api_key" } });
  const apiUrl = await prisma.setting.findUnique({ where: { key: "axonaut_api_url" } });
  return {
    apiKey: apiKey?.value || process.env.AXONAUT_API_KEY || "",
    apiUrl: apiUrl?.value || process.env.AXONAUT_API_URL || "https://axonaut.com/api/v2",
  };
}

async function axonautFetch(endpoint: string, page = 1) {
  const { apiKey, apiUrl } = await getAxonautConfig();
  if (!apiKey) throw new Error("Clé API Axonaut non configurée");

  const url = `${apiUrl}${endpoint}${endpoint.includes("?") ? "&" : "?"}page=${page}`;
  const res = await fetch(url, {
    headers: {
      "userApiKey": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Axonaut API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function syncProducts() {
  const log = await prisma.syncLog.create({
    data: { type: "products", status: "running", message: "Synchronisation des produits..." },
  });

  try {
    let page = 1;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      const data = await axonautFetch("/products", page);
      const products = Array.isArray(data) ? data : data.products || [];

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      for (const p of products) {
        const customFields = p.custom_fields || {};
        const durationMonths = parseInt(customFields["Durée en mois"] || customFields["Duree en mois"] || "0", 10);

        await prisma.product.upsert({
          where: { axonautId: p.id },
          create: {
            axonautId: p.id,
            name: p.name || "Sans nom",
            code: p.code || null,
            description: p.description || null,
            family: customFields["Famille"] || p.category || null,
            supplier: customFields["Fournisseur"] || null,
            duration: customFields["Durée"] || customFields["Duree"] || null,
            durationMonths: durationMonths || null,
            unitPrice: p.price || null,
          },
          update: {
            name: p.name || "Sans nom",
            code: p.code || null,
            description: p.description || null,
            family: customFields["Famille"] || p.category || null,
            supplier: customFields["Fournisseur"] || null,
            duration: customFields["Durée"] || customFields["Duree"] || null,
            durationMonths: durationMonths || null,
            unitPrice: p.price || null,
          },
        });
        totalSynced++;
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

    while (hasMore) {
      const data = await axonautFetch("/companies", page);
      const companies = Array.isArray(data) ? data : data.companies || [];

      if (companies.length === 0) {
        hasMore = false;
        break;
      }

      for (const c of companies) {
        if (!c.is_customer) continue;

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
          },
          update: {
            name: c.name || "Sans nom",
            email: c.email || null,
            phone: c.phone || null,
            address: c.address_street || null,
            city: c.address_city || null,
            zipCode: c.address_zip_code || null,
            country: c.address_country || null,
          },
        });
        totalSynced++;
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

    while (hasMore) {
      const data = await axonautFetch("/invoices", page);
      const invoices = Array.isArray(data) ? data : data.invoices || [];

      if (invoices.length === 0) {
        hasMore = false;
        break;
      }

      for (const inv of invoices) {
        const client = inv.company_id
          ? await prisma.client.findUnique({ where: { axonautId: inv.company_id } })
          : null;

        if (!client) continue;

        const invoice = await prisma.invoice.upsert({
          where: { axonautId: inv.id },
          create: {
            axonautId: inv.id,
            invoiceNumber: inv.number || null,
            clientId: client.id,
            invoiceDate: new Date(inv.date || inv.created_at),
            totalAmount: inv.total_amount || null,
            status: inv.status || null,
          },
          update: {
            invoiceNumber: inv.number || null,
            clientId: client.id,
            invoiceDate: new Date(inv.date || inv.created_at),
            totalAmount: inv.total_amount || null,
            status: inv.status || null,
          },
        });

        const lines = inv.lines || inv.invoice_lines || [];
        for (const line of lines) {
          const product = line.product_id
            ? await prisma.product.findUnique({ where: { axonautId: line.product_id } })
            : null;

          await prisma.invoiceLine.create({
            data: {
              invoiceId: invoice.id,
              productId: product?.id || null,
              description: line.description || line.name || null,
              quantity: line.quantity || 1,
              unitPrice: line.unit_price || null,
              totalPrice: line.total_price || null,
            },
          });
        }

        totalSynced++;
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

    const invoiceLines = await prisma.invoiceLine.findMany({
      include: {
        invoice: { include: { client: true } },
        product: true,
      },
    });

    for (const line of invoiceLines) {
      if (!line.product || !line.product.durationMonths || line.product.durationMonths <= 0) continue;
      if (!line.invoice?.client) continue;

      const existing = await prisma.installation.findFirst({
        where: {
          clientId: line.invoice.clientId,
          productId: line.product.id,
          invoiceId: line.invoiceId,
        },
      });

      if (existing) continue;

      const startDate = new Date(line.invoice.invoiceDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + line.product.durationMonths);

      const now = new Date();
      const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let status: "ACTIF" | "BIENTOT_EXPIRE" | "EXPIRE" = "ACTIF";
      if (diffDays < 0) status = "EXPIRE";
      else if (diffDays <= 90) status = "BIENTOT_EXPIRE";

      await prisma.installation.create({
        data: {
          clientId: line.invoice.clientId,
          productId: line.product.id,
          invoiceId: line.invoiceId,
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
        message: `${totalGenerated} installations générées`,
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
  const now = new Date();
  const ninetyDaysFromNow = new Date(now);
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

  await prisma.installation.updateMany({
    where: { endDate: { lt: now } },
    data: { status: "EXPIRE" },
  });

  await prisma.installation.updateMany({
    where: {
      endDate: { gte: now, lte: ninetyDaysFromNow },
    },
    data: { status: "BIENTOT_EXPIRE" },
  });

  await prisma.installation.updateMany({
    where: { endDate: { gt: ninetyDaysFromNow } },
    data: { status: "ACTIF" },
  });
}
