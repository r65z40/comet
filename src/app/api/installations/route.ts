import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const clientId = searchParams.get("clientId");
  const family = searchParams.get("family");
  const supplier = searchParams.get("supplier");
  const search = searchParams.get("search");
  const expiring = searchParams.get("expiring");
  const month = searchParams.get("month");
  const sortBy = searchParams.get("sortBy") || "endDate";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
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
    }
  }

  // Filter by month (YYYY-MM)
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split("-").map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 0, 23, 59, 59, 999);
    where.endDate = { gte: start, lte: end };
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
