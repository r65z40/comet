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
    where.status = status;
  } else if (excludeRenewed === "true") {
    where.status = { not: "RENOUVELE" };
  }
  if (clientId) where.clientId = clientId;
  if (family) where.family = family;
  if (supplier) where.supplier = supplier;

  // Filter by expiring within N days
  if (expiring) {
    const days = parseInt(expiring);
    if (!isNaN(days)) {
      const now = new Date();
      const future = new Date(now);
      future.setDate(future.getDate() + days);
      where.endDate = { gte: now, lte: future };
      where.status = { not: "RENOUVELE" };
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

  // Check if installation already exists for this line
  const existing = await prisma.installation.findUnique({
    where: { invoiceLineId },
  });
  if (existing) {
    return NextResponse.json({ error: "Une installation existe déjà pour cette ligne" }, { status: 409 });
  }

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
    // Default 12 months
    computedDuration = 12;
    computedEndDate = new Date(startDate);
    computedEndDate.setMonth(computedEndDate.getMonth() + 12);
  }

  const installation = await prisma.installation.create({
    data: {
      clientId: invoiceLine.invoice.clientId,
      productId: invoiceLine.product.id,
      invoiceId: invoiceLine.invoice.id,
      invoiceLineId: invoiceLine.id,
      supplier: invoiceLine.product.supplier || null,
      family: invoiceLine.product.family || null,
      quantity: invoiceLine.quantity,
      startDate: new Date(startDate),
      durationMonths: computedDuration,
      endDate: computedEndDate,
      status: computedEndDate < new Date() ? "EN_PARC_HORS_GARANTIE" : "EN_PARC_GARANTIE",
    },
    include: {
      product: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(installation, { status: 201 });
}
