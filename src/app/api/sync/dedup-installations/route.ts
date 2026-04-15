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
  // Charger toutes les installations actives avec leur produit
  const all = await prisma.installation.findMany({
    where: { deletedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, supplier: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const orphans = all.filter((i) => i.invoiceLineId === null);
  const linked = all.filter((i) => i.invoiceLineId !== null);

  // Normalisation pour matching flou
  const norm = (s: string | null | undefined) =>
    (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const dayDiff = (a: Date, b: Date) =>
    Math.abs(Math.floor((a.getTime() - b.getTime()) / 86400000));

  const DATE_TOLERANCE_DAYS = 3;

  const pairs: InstallationPair[] = [];
  const alreadyMatched = new Set<string>();

  for (const orphan of orphans) {
    // Candidats : même client, même nom de produit (insensible casse/espaces),
    // même fournisseur (ou les deux vides), dates à ±3 jours, non déjà appariés
    const candidates = linked.filter(
      (l) =>
        !alreadyMatched.has(l.id) &&
        l.clientId === orphan.clientId &&
        norm(l.product.name) === norm(orphan.product.name) &&
        norm(l.product.supplier) === norm(orphan.product.supplier) &&
        dayDiff(l.startDate, orphan.startDate) <= DATE_TOLERANCE_DAYS &&
        dayDiff(l.endDate, orphan.endDate) <= DATE_TOLERANCE_DAYS &&
        Math.abs(l.quantity - orphan.quantity) < 0.0001
    );

    if (candidates.length === 0) continue;

    // Prendre le candidat dont les dates sont les plus proches
    candidates.sort(
      (a, b) =>
        dayDiff(a.startDate, orphan.startDate) +
        dayDiff(a.endDate, orphan.endDate) -
        (dayDiff(b.startDate, orphan.startDate) + dayDiff(b.endDate, orphan.endDate))
    );
    const best = candidates[0];
    alreadyMatched.add(best.id);

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
        id: best.id,
        createdAt: best.createdAt,
        status: best.status,
        notes: best.notes,
        comParc: best.comParc,
        alwaysInFleet: best.alwaysInFleet,
        startDate: best.startDate,
        endDate: best.endDate,
        invoice: best.invoice,
      },
      client: orphan.client,
      product: { id: orphan.product.id, name: orphan.product.name },
    });
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
