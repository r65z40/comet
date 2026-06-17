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
    const ninetyDays = new Date(now);
    ninetyDays.setDate(ninetyDays.getDate() + 90);

    const [
      expiringInstallations,
      recentStatusChanges,
      recentActivity,
      stats,
    ] = await Promise.all([
      // Installations expiring in 90 days
      prisma.installation.findMany({
        where: {
          status: { not: "RENOUVELE" },
          alwaysInFleet: { not: true },
          endDate: { gte: now, lte: ninetyDays },
          deletedAt: null,
        },
        include: {
          client: { select: { name: true } },
          product: { select: { name: true } },
        },
        orderBy: { endDate: "asc" },
        take: 20,
      }),
      // Recent status changes (from installation history)
      prisma.installationHistory.findMany({
        where: {
          field: "status",
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        include: {
          installation: {
            select: {
              id: true,
              client: { select: { name: true } },
              product: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      // Recent activity logs
      prisma.activityLog.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.installation.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: true,
      }),
    ]);

    const expiring = expiringInstallations.map((i) => {
      const daysLeft = Math.ceil(
        (new Date(i.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: i.id,
        client: i.client.name,
        product: i.product.name,
        endDate: i.endDate.toISOString(),
        daysLeft,
      };
    });

    const statusChanges = recentStatusChanges.map((h) => ({
      id: h.id,
      client: h.installation.client.name,
      product: h.installation.product.name,
      oldStatus: h.oldValue,
      newStatus: h.newValue,
      changedBy: h.changedBy,
      date: h.createdAt.toISOString(),
    }));

    const activity = recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      userName: a.userName,
      details: a.details,
      date: a.createdAt.toISOString(),
    }));

    const enGarantie = stats.find((s) => s.status === "EN_PARC")?._count ?? 0;
    const horsGarantie = stats.find((s) => s.status === "HORS_PARC")?._count ?? 0;

    return NextResponse.json({
      expiring,
      statusChanges,
      activity,
      stats: {
        enGarantie,
        horsGarantie,
        expiring30: expiring.filter((e) => e.daysLeft <= 30).length,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Screen feed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
