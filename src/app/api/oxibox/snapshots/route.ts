import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getOxiboxToken, getAllOxiboxAccounts, getOxiboxUsage } from "@/lib/oxibox";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId requis" }, { status: 400 });

  const days = parseInt(searchParams.get("days") || "30", 10);
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);

  try {
    const snapshots = await prisma.oxiboxSnapshot.findMany({
      where: {
        organizationId: orgId,
        date: { gte: daysAgo },
      },
      orderBy: { date: "asc" },
    });

    const serialized = snapshots.map((s) => ({
      ...s,
      allocatedQuota: s.allocatedQuota != null ? Number(s.allocatedQuota) : null,
      currentUsage: s.currentUsage != null ? Number(s.currentUsage) : null,
    }));

    return NextResponse.json(serialized);
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur lors de la récupération des snapshots", details: String(err) },
      { status: 500 },
    );
  }
}

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const token = await getOxiboxToken();
  if (!token) return NextResponse.json({ error: "Clé API Oxibox non configurée" }, { status: 400 });

  try {
    const allItems = await getAllOxiboxAccounts(token);

    const allAccounts = allItems.map((item) => ({
      organizationId: item.organizationId || item.id,
      status: item.status || "UNKNOWN",
      machineCount: item.machineCount ?? item.machines?.length ?? 0,
      ongoingBackup: item.ongoingBackup ?? false,
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let snapshotCount = 0;

    for (const account of allAccounts) {
      let allocatedQuota: bigint | null = null;
      let currentUsage: bigint | null = null;

      try {
        const usageData = await getOxiboxUsage(token, account.organizationId);
        if (usageData.allocatedQuota != null) {
          allocatedQuota = BigInt(usageData.allocatedQuota);
        }
        if (usageData.currentUsage != null) {
          currentUsage = BigInt(usageData.currentUsage);
        }
      } catch {}

      try {
        await prisma.oxiboxSnapshot.upsert({
          where: {
            organizationId_date: {
              organizationId: account.organizationId,
              date: today,
            },
          },
          update: {
            status: account.status,
            machineCount: account.machineCount,
            ongoingBackup: account.ongoingBackup,
            allocatedQuota,
            currentUsage,
          },
          create: {
            organizationId: account.organizationId,
            status: account.status,
            machineCount: account.machineCount,
            ongoingBackup: account.ongoingBackup,
            allocatedQuota,
            currentUsage,
            date: today,
          },
        });
        snapshotCount++;
      } catch (err) {
        console.error(`Failed to upsert snapshot for ${account.organizationId}:`, err);
      }
    }

    return NextResponse.json({ success: true, count: snapshotCount });
  } catch (err) {
    return NextResponse.json(
      { error: "Erreur lors de la création des snapshots", details: String(err) },
      { status: 500 },
    );
  }
}
