import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { installationPatchSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  let includeHistory = {};
  try {
    // Check if InstallationHistory table exists (migration may not have run yet)
    await prisma.$queryRaw`SELECT 1 FROM installation_history LIMIT 1`;
    includeHistory = {
      history: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    };
  } catch {
    // Table doesn't exist yet — skip history
  }

  const installation = await prisma.installation.findUnique({
    where: { id },
    include: {
      client: true,
      product: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalAmount: true,
          status: true,
          lines: {
            select: { id: true, description: true, quantity: true, unitPrice: true, totalPrice: true },
          },
        },
      },
      ...includeHistory,
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
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { id } = await params;
  const raw = await req.json();
  const parsed = installationPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const body = parsed.data;
  const changedBy = session.user?.name || session.user?.email || "Inconnu";

  // Fetch current installation for history comparison
  const current = await prisma.installation.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Installation non trouvée" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.comParc !== undefined) updateData.comParc = body.comParc;
  if (body.status) updateData.status = body.status;
  if (body.alwaysInFleet !== undefined) updateData.alwaysInFleet = body.alwaysInFleet;
  if (body.endDate) updateData.endDate = new Date(body.endDate);
  if (body.startDate) updateData.startDate = new Date(body.startDate);
  if (body.durationMonths !== undefined) updateData.durationMonths = body.durationMonths;
  if (body.family !== undefined) updateData.family = body.family || null;
  if (body.supplier !== undefined) updateData.supplier = body.supplier || null;
  if (body.quantity !== undefined) updateData.quantity = body.quantity;

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

  await logActivity({
    userId: session.user?.id,
    userName: changedBy,
    action: "UPDATE",
    entity: "installation",
    entityId: id,
    details: historyEntries.map((e) => `${e.field}: ${e.oldValue || "—"} → ${e.newValue || "—"}`).join(", "),
  });

  // Save history entries (skip if table doesn't exist)
  if (historyEntries.length > 0) {
    try {
      await prisma.installationHistory.createMany({
        data: historyEntries.map((e) => ({
          installationId: id,
          ...e,
        })),
      });
    } catch {
      // installation_history table may not exist yet
    }
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

  const installation = await prisma.installation.findUnique({
    where: { id },
    select: { product: { select: { name: true } }, client: { select: { name: true } } },
  });

  await prisma.installation.update({ where: { id }, data: { deletedAt: new Date() } });

  await logActivity({
    userId: session.user?.id,
    userName: session.user?.name || session.user?.email,
    action: "DELETE",
    entity: "installation",
    entityId: id,
    details: installation ? `${installation.client.name} — ${installation.product.name}` : null,
  });

  return NextResponse.json({ success: true });
}
