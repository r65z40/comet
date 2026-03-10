import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const now = new Date();
  const thirtyDays = new Date(now);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const sixtyDays = new Date(now);
  sixtyDays.setDate(sixtyDays.getDate() + 60);
  const ninetyDays = new Date(now);
  ninetyDays.setDate(ninetyDays.getDate() + 90);

  const [
    totalInstallations,
    activeInstallations,
    soonExpiring,
    expiredInstallations,
    expiring30,
    expiring60,
    expiring90,
    byFamily,
    bySupplier,
    byMonth,
    totalClients,
    totalProducts,
  ] = await Promise.all([
    prisma.installation.count(),
    prisma.installation.count({ where: { status: "ACTIF" } }),
    prisma.installation.count({ where: { status: "BIENTOT_EXPIRE" } }),
    prisma.installation.count({ where: { status: "EXPIRE" } }),
    prisma.installation.count({
      where: { endDate: { gte: now, lte: thirtyDays } },
    }),
    prisma.installation.count({
      where: { endDate: { gte: now, lte: sixtyDays } },
    }),
    prisma.installation.count({
      where: { endDate: { gte: now, lte: ninetyDays } },
    }),
    prisma.installation.groupBy({
      by: ["family"],
      _count: { id: true },
      where: { family: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.installation.groupBy({
      by: ["supplier"],
      _count: { id: true },
      where: { supplier: { not: null } },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.$queryRaw`
      SELECT
        TO_CHAR("endDate", 'YYYY-MM') as month,
        COUNT(*)::int as count
      FROM installations
      WHERE "endDate" >= NOW() - INTERVAL '3 months'
        AND "endDate" <= NOW() + INTERVAL '12 months'
      GROUP BY TO_CHAR("endDate", 'YYYY-MM')
      ORDER BY month ASC
    `,
    prisma.client.count(),
    prisma.product.count(),
  ]);

  const upcomingRenewals = await prisma.installation.findMany({
    where: {
      endDate: { gte: now, lte: ninetyDays },
    },
    include: {
      client: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { endDate: "asc" },
    take: 10,
  });

  return NextResponse.json({
    counts: {
      total: totalInstallations,
      active: activeInstallations,
      soonExpiring,
      expired: expiredInstallations,
      expiring30,
      expiring60,
      expiring90,
      totalClients,
      totalProducts,
    },
    byFamily: byFamily.map((f) => ({
      name: f.family || "Non classé",
      value: f._count.id,
    })),
    bySupplier: bySupplier.map((s) => ({
      name: s.supplier || "Non classé",
      value: s._count.id,
    })),
    byMonth,
    upcomingRenewals,
  });
}
