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

  const updateData: Record<string, unknown> = {};
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.status && ["EN_PARC_GARANTIE", "EN_PARC_HORS_GARANTIE", "RENOUVELE"].includes(body.status)) {
    updateData.status = body.status;
  }
  if (body.endDate) {
    updateData.endDate = new Date(body.endDate);
  }

  const installation = await prisma.installation.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(installation);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  await prisma.installation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
