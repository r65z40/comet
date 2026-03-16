import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { autoCorrectInstallationStatuses } from "@/lib/auto-status";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
  // Auto-correct: warranty valid → EN_PARC
  await autoCorrectInstallationStatuses();

  const now = new Date();
  const thirtyDays = new Date(now);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const sixtyDays = new Date(now);
  sixtyDays.setDate(sixtyDays.getDate() + 60);
  const ninetyDays = new Date(now);
  ninetyDays.setDate(ninetyDays.getDate() + 90);

  const [
    totalInstallations,
    enGarantie,
    horsGarantie,
    renouvele,
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
    prisma.installation.count({ where: { status: { in: ["EN_PARC", "EN_PARC_GARANTIE"] } } }),
    prisma.installation.count({ where: { status: { in: ["HORS_PARC", "EN_PARC_HORS_GARANTIE"] } } }),
    prisma.installation.count({ where: { status: "RENOUVELE" } }),
    prisma.installation.count({
      where: { endDate: { gte: now, lte: thirtyDays }, status: { not: "RENOUVELE" } },
    }),
    prisma.installation.count({
      where: { endDate: { gte: now, lte: sixtyDays }, status: { not: "RENOUVELE" } },
    }),
    prisma.installation.count({
      where: { endDate: { gte: now, lte: ninetyDays }, status: { not: "RENOUVELE" } },
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
        AND status != 'RENOUVELE'
      GROUP BY TO_CHAR("endDate", 'YYYY-MM')
      ORDER BY month ASC
    `,
    prisma.client.count(),
    prisma.product.count(),
  ]);

  const upcomingRenewals = await prisma.installation.findMany({
    where: {
      status: { not: "RENOUVELE" },
      endDate: { gte: now, lte: ninetyDays },
    },
    include: {
      client: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { endDate: "asc" },
    take: 15,
  });

  const recentlyExpired = await prisma.installation.findMany({
    where: {
      status: { in: ["HORS_PARC", "EN_PARC_HORS_GARANTIE"] },
    },
    include: {
      client: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { endDate: "desc" },
    take: 10,
  });

  return NextResponse.json({
    counts: {
      total: totalInstallations,
      enGarantie,
      horsGarantie,
      renouvele,
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
    recentlyExpired,
  });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
