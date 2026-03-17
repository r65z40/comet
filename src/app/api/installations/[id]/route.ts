import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const installation = await prisma.installation.findUnique({
    where: { id },
    include: {
      client: true,
      product: true,
      invoice: { include: { lines: true } },
      history: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  if (!installation) {
    return NextResponse.json({ error: "Installation non trouvée" }, { status: 404 });
  }

  return NextResponse.json(installation);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const changedBy = session.user?.name || session.user?.email || "Inconnu";

  // Fetch current installation for history comparison
  const current = await prisma.installation.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Installation non trouvée" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.comParc !== undefined) updateData.comParc = body.comParc;
  if (body.status && ["EN_PARC", "HORS_PARC", "RENOUVELE", "EN_PARC_GARANTIE", "EN_PARC_HORS_GARANTIE"].includes(body.status)) {
    updateData.status = body.status;
  }
  if (body.alwaysInFleet !== undefined) {
    updateData.alwaysInFleet = Boolean(body.alwaysInFleet);
  }
  if (body.endDate) {
    updateData.endDate = new Date(body.endDate);
  }
  if (body.startDate) {
    updateData.startDate = new Date(body.startDate);
  }
  if (body.durationMonths !== undefined) {
    updateData.durationMonths = parseInt(body.durationMonths, 10);
  }
  if (body.family !== undefined) {
    updateData.family = body.family || null;
  }
  if (body.supplier !== undefined) {
    updateData.supplier = body.supplier || null;
  }
  if (body.quantity !== undefined) {
    updateData.quantity = parseFloat(body.quantity);
  }

  // Build history entries for changed fields
  const fieldLabels: Record<string, string> = {
    status: "Statut",
    alwaysInFleet: "Toujours en parc",
    endDate: "Fin garantie",
    startDate: "Début garantie",
    durationMonths: "Durée",
    family: "Famille",
    supplier: "Fournisseur",
    quantity: "Quantité",
    comParc: "Com Parc",
    notes: "Notes",
  };

  const historyEntries: { field: string; oldValue: string | null; newValue: string | null; changedBy: string }[] = [];
  const trackedFields = ["status", "alwaysInFleet", "endDate", "startDate", "durationMonths", "family", "supplier", "quantity", "comParc"];

  for (const field of trackedFields) {
    if (updateData[field] === undefined) continue;
    const oldVal = current[field as keyof typeof current];
    const newVal = updateData[field];

    let oldStr = oldVal != null ? String(oldVal) : null;
    let newStr = newVal != null ? String(newVal) : null;

    // Format dates for readability
    if ((field === "endDate" || field === "startDate") && oldVal instanceof Date) {
      oldStr = oldVal.toISOString().split("T")[0];
    }
    if ((field === "endDate" || field === "startDate") && newVal instanceof Date) {
      newStr = (newVal as Date).toISOString().split("T")[0];
    }

    if (oldStr !== newStr) {
      historyEntries.push({
        field: fieldLabels[field] || field,
        oldValue: oldStr,
        newValue: newStr,
        changedBy,
      });
    }
  }

  const installation = await prisma.installation.update({
    where: { id },
    data: updateData,
  });

  // Save history entries
  if (historyEntries.length > 0) {
    await prisma.installationHistory.createMany({
      data: historyEntries.map((e) => ({
        installationId: id,
        ...e,
      })),
    });
  }

  return NextResponse.json(installation);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;

  await prisma.installation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
