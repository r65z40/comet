import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {

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
      upcomingRenewals,
      recentlyExpired,
      topClientsRaw,
      statusBreakdown,
      financialRaw,
      recentSyncLogs,
    ] = await Promise.all([
      prisma.installation.count(),
      prisma.installation.count({ where: { status: { in: ["EN_PARC", "EN_PARC_GARANTIE"] } } }),
      prisma.installation.count({ where: { status: { in: ["HORS_PARC", "EN_PARC_HORS_GARANTIE"] } } }),
      prisma.installation.count({ where: { status: "RENOUVELE" } }),
      prisma.installation.count({
        where: { endDate: { gte: now, lte: thirtyDays }, status: { not: "RENOUVELE" }, alwaysInFleet: { not: true } },
      }),
      prisma.installation.count({
        where: { endDate: { gte: now, lte: sixtyDays }, status: { not: "RENOUVELE" }, alwaysInFleet: { not: true } },
      }),
      prisma.installation.count({
        where: { endDate: { gte: now, lte: ninetyDays }, status: { not: "RENOUVELE" }, alwaysInFleet: { not: true } },
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
          AND ("alwaysInFleet" IS NULL OR "alwaysInFleet" = false)
        GROUP BY TO_CHAR("endDate", 'YYYY-MM')
        ORDER BY month ASC
      `,
      prisma.client.count(),
      prisma.product.count(),
      prisma.installation.findMany({
        where: {
          status: { not: "RENOUVELE" },
          alwaysInFleet: { not: true },
          endDate: { gte: now, lte: ninetyDays },
        },
        include: {
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
        orderBy: { endDate: "asc" },
        take: 15,
      }),
      prisma.installation.findMany({
        where: {
          status: { in: ["HORS_PARC", "EN_PARC_HORS_GARANTIE"] },
        },
        include: {
          client: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
        },
        orderBy: { endDate: "desc" },
        take: 10,
      }),
      // Top clients by installation count
      prisma.installation.groupBy({
        by: ["clientId"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      // Status breakdown
      prisma.installation.groupBy({
        by: ["status"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      // Financial data (avg duration, total value from invoice lines)
      prisma.installation.aggregate({
        _avg: { durationMonths: true },
        _count: { id: true },
      }),
      // Recent sync logs
      prisma.syncLog.findMany({
        orderBy: { startedAt: "desc" },
        take: 10,
      }),
    ]);

    // Resolve top client names
    const topClientIds = topClientsRaw.map((c) => c.clientId);
    const topClientNames = topClientIds.length > 0
      ? await prisma.client.findMany({
          where: { id: { in: topClientIds } },
          select: { id: true, name: true },
        })
      : [];
    const clientNameMap = new Map(topClientNames.map((c) => [c.id, c.name]));
    const topClients = topClientsRaw.map((c) => ({
      id: c.clientId,
      name: clientNameMap.get(c.clientId) || "Inconnu",
      count: c._count.id,
    }));

    // Financial summary
    const totalCount = financialRaw._count.id || 1;
    const renewalRate = totalCount > 0 ? (renouvele / totalCount) * 100 : 0;

    // Get total invoice value
    const totalValueResult = await prisma.invoiceLine.aggregate({ _sum: { totalPrice: true } });
    const totalValue = totalValueResult._sum.totalPrice || 0;

    // Board cards for dashboard
    const boardCards = await prisma.boardCard.findMany({
      include: {
        column: { select: { id: true, name: true, color: true } },
        client: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        tags: { include: { tag: true } },
        _count: { select: { comments: true, attachments: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    });

    // Recent activity from sync logs
    const recentActivity = recentSyncLogs.map((log) => ({
      id: log.id,
      type: "sync",
      description: `${log.type} — ${log.status}${log.itemCount > 0 ? ` (${log.itemCount} éléments)` : ""}${log.message ? `: ${log.message}` : ""}`,
      date: log.startedAt.toISOString(),
    }));

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
      topClients,
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      financialSummary: {
        totalValue,
        avgDuration: financialRaw._avg.durationMonths || 0,
        renewalRate,
      },
      recentActivity,
      boardCards,
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
