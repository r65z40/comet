import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { installationCreateSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const family = searchParams.get("family");
  const supplier = searchParams.get("supplier");
  const search = searchParams.get("search");
  const expiring = searchParams.get("expiring");
  const month = searchParams.get("month");
  const ALLOWED_SORT_FIELDS = ["endDate", "startDate", "status", "durationMonths", "family", "supplier", "createdAt"];
  const rawSortBy = searchParams.get("sortBy") || "endDate";
  const sortBy = ALLOWED_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : "endDate";
  const rawSortOrder = searchParams.get("sortOrder") || "asc";
  const sortOrder = rawSortOrder === "desc" ? "desc" : "asc";

  const excludeRenewed = searchParams.get("excludeRenewed");
  const includeDeleted = searchParams.get("deleted") === "true";
  const where: Record<string, unknown> = {};
  if (!includeDeleted) where.deletedAt = null;

  if (status) {
    if (status === "EN_PARC") {
      where.status = { in: ["EN_PARC", "EN_PARC_GARANTIE"] };
    } else if (status === "HORS_PARC") {
      where.status = { in: ["HORS_PARC", "EN_PARC_HORS_GARANTIE"] };
      delete where.deletedAt;
    } else {
      where.status = status;
    }
  } else if (excludeRenewed === "true") {
    where.status = { not: "RENOUVELE" };
  }
  if (clientId) where.clientId = clientId;
  if (family) where.family = { contains: family, mode: "insensitive" };
  if (supplier) where.supplier = { contains: supplier, mode: "insensitive" };

  // Filter by expiring within N days
  if (expiring) {
    const days = parseInt(expiring);
    if (!isNaN(days)) {
      const now = new Date();
      const future = new Date(now);
      future.setDate(future.getDate() + days);
      where.endDate = { gte: now, lte: future };
      if (!status) where.status = { not: "RENOUVELE" };
      where.alwaysInFleet = { not: true };
    }
  }

  // Filter by month (YYYY-MM) — mirrors the dashboard chart filter
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59, 999);
    where.endDate = { gte: start, lte: end };
    if (!status) where.status = { not: "RENOUVELE" };
    where.alwaysInFleet = { not: true };
  }

  if (search) {
    where.OR = [
      { product: { name: { contains: search, mode: "insensitive" } } },
      { client: { name: { contains: search, mode: "insensitive" } } },
      { family: { contains: search, mode: "insensitive" } },
      { supplier: { contains: search, mode: "insensitive" } },
    ];
  }

  const [installations, total] = await Promise.all([
    prisma.installation.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, code: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.installation.count({ where }),
  ]);

  return NextResponse.json({
    installations,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const raw = await req.json();
  const parsed = installationCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { invoiceLineId, durationMonths, endDate } = parsed.data;

  // Load invoice line with product and invoice
  const invoiceLine = await prisma.invoiceLine.findUnique({
    where: { id: invoiceLineId },
    include: {
      invoice: { include: { client: true } },
      product: true,
    },
  });

  if (!invoiceLine) {
    return NextResponse.json({ error: "Ligne de facture non trouvée" }, { status: 404 });
  }
  if (!invoiceLine.product) {
    return NextResponse.json({ error: "Aucun produit lié à cette ligne" }, { status: 400 });
  }

  // Count existing active installations for this line
  const existingCount = await prisma.installation.count({
    where: { invoiceLineId, deletedAt: null },
  });
  const unitCount = Math.max(1, Math.round(invoiceLine.quantity));
  if (existingCount >= unitCount) {
    return NextResponse.json({ error: "Toutes les installations sont déjà créées pour cette ligne" }, { status: 409 });
  }

  // Remove soft-deleted installations
  await prisma.installation.deleteMany({
    where: { invoiceLineId, deletedAt: { not: null } },
  });

  const startDate = invoiceLine.invoice.invoiceDate;
  let computedEndDate: Date;
  let computedDuration: number;

  if (endDate) {
    computedEndDate = new Date(endDate);
    computedDuration = durationMonths || Math.max(
      1,
      Math.round((computedEndDate.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
    );
  } else if (durationMonths) {
    computedDuration = durationMonths;
    computedEndDate = new Date(startDate);
    computedEndDate.setMonth(computedEndDate.getMonth() + durationMonths);
  } else if (invoiceLine.product.durationMonths) {
    computedDuration = invoiceLine.product.durationMonths;
    computedEndDate = new Date(startDate);
    computedEndDate.setMonth(computedEndDate.getMonth() + computedDuration);
  } else {
    computedDuration = 12;
    computedEndDate = new Date(startDate);
    computedEndDate.setMonth(computedEndDate.getMonth() + 12);
  }

  const toCreate = unitCount - existingCount;
  const created = [];
  for (let i = 0; i < toCreate; i++) {
    const inst = await prisma.installation.create({
      data: {
        clientId: invoiceLine.invoice.clientId,
        productId: invoiceLine.product.id,
        invoiceId: invoiceLine.invoice.id,
        invoiceLineId: invoiceLine.id,
        supplier: invoiceLine.product.supplier || null,
        family: invoiceLine.product.family || null,
        quantity: 1,
        startDate: new Date(startDate),
        durationMonths: computedDuration,
        endDate: computedEndDate,
        status: "EN_PARC",
      },
      include: {
        product: { select: { id: true, name: true } },
      },
    });
    created.push(inst);
  }

  return NextResponse.json(created.length === 1 ? created[0] : created, { status: 201 });
}
