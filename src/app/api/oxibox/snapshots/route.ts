import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const OXIBOX_API = "https://api.oxibox.com";

async function getOxiboxToken(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: "oxibox_api_key" } });
  return row?.value || null;
}

// GET — Return snapshots for an organization over the last N days
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

    // Convert BigInt fields to Number for JSON serialization
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

// POST — Take a daily snapshot of ALL Oxibox accounts (called by cron)
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const token = await getOxiboxToken();
  if (!token) return NextResponse.json({ error: "Clé API Oxibox non configurée" }, { status: 400 });

  try {
    // Fetch all accounts with pagination
    const allAccounts: Array<{
      organizationId: string;
      status: string;
      machineCount: number;
      ongoingBackup: boolean;
    }> = [];

    let skip = 0;
    const limit = 200;

    while (true) {
      const res = await fetch(
        `${OXIBOX_API}/status?skip=${skip}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Oxibox API error ${res.status}`, details: text },
          { status: res.status },
        );
      }

      const data = await res.json();
      const items = data.items || data.data || data;

      if (!Array.isArray(items) || items.length === 0) break;

      for (const item of items) {
        allAccounts.push({
          organizationId: item.organizationId || item.id,
          status: item.status || "UNKNOWN",
          machineCount: item.machineCount ?? item.machines?.length ?? 0,
          ongoingBackup: item.ongoingBackup ?? false,
        });
      }

      if (items.length < limit) break;
      skip += limit;
    }

    // Today at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let snapshotCount = 0;

    for (const account of allAccounts) {
      // Try to fetch usage data for each account
      let allocatedQuota: bigint | null = null;
      let currentUsage: bigint | null = null;

      try {
        const usageRes = await fetch(
          `${OXIBOX_API}/usage/cloud/${encodeURIComponent(account.organizationId)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
          },
        );

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          if (usageData.allocatedQuota != null) {
            allocatedQuota = BigInt(usageData.allocatedQuota);
          }
          if (usageData.currentUsage != null) {
            currentUsage = BigInt(usageData.currentUsage);
          }
        }
      } catch {
        // Usage fetch failed for this org — continue without quota data
      }

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
