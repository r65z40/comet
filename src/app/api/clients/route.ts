import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));
  const search = searchParams.get("search");

  const showAll = searchParams.get("showAll") === "true";

  const conditions: Prisma.ClientWhereInput[] = [];

  // By default exclude fournisseurs and prospects (null is treated as client)
  if (!showAll) {
    conditions.push({
      OR: [
        { clientType: "client" },
        { clientType: null },
      ],
    });
  }

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const where: Prisma.ClientWhereInput = conditions.length > 0
    ? { AND: conditions }
    : {};

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        _count: { select: { installations: true, invoices: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({
    clients,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
