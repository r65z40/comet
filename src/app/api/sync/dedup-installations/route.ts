import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

/**
 * GET /api/sync/dedup-installations
 *   → Dry-run : liste les paires de doublons détectées.
 *
 * POST /api/sync/dedup-installations
 *   body: { victimIds: string[] }  // liste des IDs d'installations à archiver
 *   → Fusionne : transfère metadata/historique de la victime vers la keeper,
 *     puis soft-delete la victime.
 *
 * Matching : même client + produit (nom + fournisseur normalisés) + quantité
 * + dates ±3 jours. Peut apparier : orpheline↔liée facture, orphan↔orphan,
 * ou deux factures différentes (doublons d'import manuel, Axonaut, etc.).
 */

interface InstallationSide {
  id: string;
  createdAt: Date;
  status: string;
  notes: string | null;
  comParc: string | null;
  alwaysInFleet: boolean;
  startDate: Date;
  endDate: Date;
  invoice: { id: string; invoiceNumber: string | null } | null;
  invoiceLineId: string | null;
  historyCount: number;
}

interface InstallationPair {
  victim: InstallationSide;   // celle qui sera archivée
  keeper: InstallationSide;   // celle qui est conservée
  client: { id: string; name: string };
  product: { id: string; name: string };
  reason: string;             // pourquoi cette paire est considérée comme doublon
}

function metadataScore(i: {
  notes: string | null;
  comParc: string | null;
  alwaysInFleet: boolean;
  historyCount: number;
  invoiceLineId: string | null;
}): number {
  let s = 0;
  if (i.invoiceLineId) s += 1000; // prédominance écrasante
  if (i.notes) s += 10;
  if (i.comParc) s += 10;
  if (i.alwaysInFleet) s += 5;
  s += i.historyCount;
  return s;
}

async function findDuplicatePairs(): Promise<InstallationPair[]> {
  // Charger toutes les installations actives avec leur produit + historique count
  const all = await prisma.installation.findMany({
    where: { deletedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, supplier: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      _count: { select: { history: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Normalisation pour matching flou
  const norm = (s: string | null | undefined) =>
    (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  const dayDiff = (a: Date, b: Date) =>
    Math.abs(Math.floor((a.getTime() - b.getTime()) / 86400000));

  const DATE_TOLERANCE_DAYS = 3;

  // Grouper par (clientId + nomProduit + fournisseur + quantité)
  type Installation = (typeof all)[number];
  const groups = new Map<string, Installation[]>();

  for (const inst of all) {
    const key = [
      inst.clientId,
      norm(inst.product.name),
      norm(inst.product.supplier),
      inst.quantity.toFixed(2),
    ].join("|");
    const arr = groups.get(key) || [];
    arr.push(inst);
    groups.set(key, arr);
  }

  const pairs: InstallationPair[] = [];
  const alreadyPaired = new Set<string>();

  // Pour chaque groupe de 2+ installations, chercher des paires compatibles
  for (const group of groups.values()) {
    if (group.length < 2) continue;

    for (let i = 0; i < group.length; i++) {
      if (alreadyPaired.has(group[i].id)) continue;
      for (let j = i + 1; j < group.length; j++) {
        if (alreadyPaired.has(group[j].id)) continue;
        const a = group[i];
        const b = group[j];
        if (
          dayDiff(a.startDate, b.startDate) <= DATE_TOLERANCE_DAYS &&
          dayDiff(a.endDate, b.endDate) <= DATE_TOLERANCE_DAYS
        ) {
          // Choisir laquelle garder
          const sideA = {
            id: a.id,
            createdAt: a.createdAt,
            status: a.status,
            notes: a.notes,
            comParc: a.comParc,
            alwaysInFleet: a.alwaysInFleet,
            startDate: a.startDate,
            endDate: a.endDate,
            invoice: a.invoice,
            invoiceLineId: a.invoiceLineId,
            historyCount: a._count.history,
          };
          const sideB = {
            id: b.id,
            createdAt: b.createdAt,
            status: b.status,
            notes: b.notes,
            comParc: b.comParc,
            alwaysInFleet: b.alwaysInFleet,
            startDate: b.startDate,
            endDate: b.endDate,
            invoice: b.invoice,
            invoiceLineId: b.invoiceLineId,
            historyCount: b._count.history,
          };

          const scoreA = metadataScore(sideA);
          const scoreB = metadataScore(sideB);

          let keeper, victim;
          if (scoreA > scoreB) {
            keeper = sideA; victim = sideB;
          } else if (scoreB > scoreA) {
            keeper = sideB; victim = sideA;
          } else {
            // Égalité : garder la plus ancienne
            if (a.createdAt <= b.createdAt) { keeper = sideA; victim = sideB; }
            else { keeper = sideB; victim = sideA; }
          }

          // Raison lisible
          let reason = "";
          if (keeper.invoiceLineId && !victim.invoiceLineId) {
            reason = "Liée à une facture vs orpheline";
          } else if (!keeper.invoiceLineId && !victim.invoiceLineId) {
            reason = "Deux imports manuels sans facture";
          } else if (keeper.invoiceLineId && victim.invoiceLineId) {
            reason = "Deux factures différentes";
          } else {
            reason = "Doublon";
          }

          alreadyPaired.add(a.id);
          alreadyPaired.add(b.id);

          pairs.push({
            victim,
            keeper,
            client: a.client,
            product: { id: a.product.id, name: a.product.name },
            reason,
          });
          break; // passer au i suivant
        }
      }
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
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  // Accepter victimIds (nouveau) et orphanIds (ancien, rétrocompat)
  const victimIds: string[] = body.victimIds || body.orphanIds || [];
  if (!Array.isArray(victimIds) || victimIds.length === 0) {
    return NextResponse.json({ error: "Aucune installation à fusionner" }, { status: 400 });
  }

  const log = await prisma.syncLog.create({
    data: {
      type: "installations_dedup",
      status: "running",
      message: `Fusion de ${victimIds.length} doublons...`,
    },
  });

  try {
    let merged = 0;
    let failed = 0;
    const mergedDetails: string[] = [];

    // Re-détecter les paires côté serveur (anti-falsification)
    const allPairs = await findDuplicatePairs();
    const pairsToMerge = allPairs.filter((p) => victimIds.includes(p.victim.id));

    for (const pair of pairsToMerge) {
      try {
        await prisma.$transaction(async (tx) => {
          // Transférer les champs utilisateur (seulement si vides chez le keeper)
          const updateData: {
            notes?: string;
            comParc?: string;
            alwaysInFleet?: boolean;
            status?: string;
          } = {};

          if (pair.victim.notes && !pair.keeper.notes) {
            updateData.notes = pair.victim.notes;
          }
          if (pair.victim.comParc && !pair.keeper.comParc) {
            updateData.comParc = pair.victim.comParc;
          }
          if (pair.victim.alwaysInFleet && !pair.keeper.alwaysInFleet) {
            updateData.alwaysInFleet = true;
          }
          if (
            pair.keeper.status === "EN_PARC" &&
            pair.victim.status !== "EN_PARC"
          ) {
            updateData.status = pair.victim.status;
          }

          if (Object.keys(updateData).length > 0) {
            await tx.installation.update({
              where: { id: pair.keeper.id },
              data: updateData,
            });
          }

          // Transférer l'historique
          await tx.installationHistory.updateMany({
            where: { installationId: pair.victim.id },
            data: { installationId: pair.keeper.id },
          });

          // Soft-delete de la victime
          await tx.installation.update({
            where: { id: pair.victim.id },
            data: {
              deletedAt: new Date(),
              notes: `[Fusionnée avec ${pair.keeper.id} le ${new Date().toISOString()}] ${pair.victim.notes || ""}`.trim(),
            },
          });
        });

        merged++;
        mergedDetails.push(`${pair.client.name} / ${pair.product.name}`);
      } catch (e) {
        failed++;
        console.error(`Fusion échouée pour victim ${pair.victim.id}:`, e);
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
