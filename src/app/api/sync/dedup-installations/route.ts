import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/sync/dedup-installations
 *   → Dry-run : liste les paires (orpheline ↔ liée à une facture) détectées.
 *
 * POST /api/sync/dedup-installations
 *   body: { pairIds: string[] }  // liste des IDs d'orphelines à fusionner
 *   → Exécute la fusion : transfère notes/comParc/alwaysInFleet/historique vers
 *     l'installation liée à la facture, puis soft-delete l'orpheline.
 */

interface InstallationPair {
  orphan: {
    id: string;
    createdAt: Date;
    status: string;
    notes: string | null;
    comParc: string | null;
    alwaysInFleet: boolean;
    startDate: Date;
    endDate: Date;
  };
    linked: {
    id: string;
    createdAt: Date;
    status: string;
    notes: string | null;
    comParc: string | null;
    alwaysInFleet: boolean;
    startDate: Date;
    endDate: Date;
    invoice: { id: string; invoiceNumber: string | null } | null;
  };
  client: { id: string; name: string };
  product: { id: string; name: string };
}

async function findDuplicatePairs(): Promise<InstallationPair[]> {
  // Toutes les installations orphelines (hors soft-deleted)
  const orphans = await prisma.installation.findMany({
    where: {
      invoiceLineId: null,
      deletedAt: null,
    },
    include: {
      client: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pairs: InstallationPair[] = [];
  const alreadyMatched = new Set<string>();

  for (const orphan of orphans) {
    const startDay = new Date(orphan.startDate);
    startDay.setHours(0, 0, 0, 0);
    const nextDay = new Date(startDay);
    nextDay.setDate(nextDay.getDate() + 1);
    const endDay = new Date(orphan.endDate);
    endDay.setHours(0, 0, 0, 0);
    const endNextDay = new Date(endDay);
    endNextDay.setDate(endNextDay.getDate() + 1);

    // Chercher l'installation liée à une facture qui correspond
    const linked = await prisma.installation.findFirst({
      where: {
        clientId: orphan.clientId,
        productId: orphan.productId,
        invoiceLineId: { not: null },
        deletedAt: null,
        startDate: { gte: startDay, lt: nextDay },
        endDate: { gte: endDay, lt: endNextDay },
        id: { notIn: Array.from(alreadyMatched) },
      },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    if (linked) {
      alreadyMatched.add(linked.id);
      pairs.push({
        orphan: {
          id: orphan.id,
          createdAt: orphan.createdAt,
          status: orphan.status,
          notes: orphan.notes,
          comParc: orphan.comParc,
          alwaysInFleet: orphan.alwaysInFleet,
          startDate: orphan.startDate,
          endDate: orphan.endDate,
        },
        linked: {
          id: linked.id,
          createdAt: linked.createdAt,
          status: linked.status,
          notes: linked.notes,
          comParc: linked.comParc,
          alwaysInFleet: linked.alwaysInFleet,
          startDate: linked.startDate,
          endDate: linked.endDate,
          invoice: linked.invoice,
        },
        client: orphan.client,
        product: orphan.product,
      });
    }
  }

  return pairs;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const pairs = await findDuplicatePairs();
    return NextResponse.json({ pairs, count: pairs.length });
  } catch (error) {
    console.error("dedup-installations analyse error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur d'analyse" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const orphanIds: string[] = body.orphanIds || [];
  if (!Array.isArray(orphanIds) || orphanIds.length === 0) {
    return NextResponse.json({ error: "Aucune installation à fusionner" }, { status: 400 });
  }

  const log = await prisma.syncLog.create({
    data: {
      type: "installations_dedup",
      status: "running",
      message: `Fusion de ${orphanIds.length} doublons...`,
    },
  });

  try {
    let merged = 0;
    let failed = 0;
    const mergedDetails: string[] = [];

    // Re-détecter les paires côté serveur pour éviter qu'un client soumette un id frauduleux
    const allPairs = await findDuplicatePairs();
    const pairsToMerge = allPairs.filter((p) => orphanIds.includes(p.orphan.id));

    for (const pair of pairsToMerge) {
      try {
        await prisma.$transaction(async (tx) => {
          // Préparer les champs à transférer (seulement si vides côté facture)
          const updateData: {
            notes?: string;
            comParc?: string;
            alwaysInFleet?: boolean;
            status?: string;
          } = {};

          if (pair.orphan.notes && !pair.linked.notes) {
            updateData.notes = pair.orphan.notes;
          }
          if (pair.orphan.comParc && !pair.linked.comParc) {
            updateData.comParc = pair.orphan.comParc;
          }
          if (pair.orphan.alwaysInFleet && !pair.linked.alwaysInFleet) {
            updateData.alwaysInFleet = true;
          }
          // Si la liée à la facture a encore le status par défaut, prendre celui de l'orpheline
          if (
            pair.linked.status === "EN_PARC_GARANTIE" &&
            pair.orphan.status !== "EN_PARC_GARANTIE"
          ) {
            updateData.status = pair.orphan.status;
          }

          if (Object.keys(updateData).length > 0) {
            await tx.installation.update({
              where: { id: pair.linked.id },
              data: updateData,
            });
          }

          // Transférer l'historique
          await tx.installationHistory.updateMany({
            where: { installationId: pair.orphan.id },
            data: { installationId: pair.linked.id },
          });

          // Soft-delete de l'orpheline
          await tx.installation.update({
            where: { id: pair.orphan.id },
            data: {
              deletedAt: new Date(),
              notes: `[Fusionnée avec ${pair.linked.id} le ${new Date().toISOString()}] ${pair.orphan.notes || ""}`.trim(),
            },
          });
        });

        merged++;
        mergedDetails.push(`${pair.client.name} / ${pair.product.name}`);
      } catch (e) {
        failed++;
        console.error(`Fusion échouée pour orphan ${pair.orphan.id}:`, e);
      }
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: failed === 0 ? "success" : "error",
        message: `${merged} doublons fusionnés${failed > 0 ? `, ${failed} échecs` : ""}`,
        itemCount: merged,
        completedAt: new Date(),
        details: mergedDetails.slice(0, 50).join("\n"),
      },
    });

    return NextResponse.json({ merged, failed });
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Erreur de fusion",
        completedAt: new Date(),
      },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de fusion" },
      { status: 500 }
    );
  }
}
