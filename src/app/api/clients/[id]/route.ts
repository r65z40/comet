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

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      installations: {
        where: { deletedAt: null },
        include: {
          product: { select: { id: true, name: true, code: true } },
          invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true } },
        },
        orderBy: { endDate: "asc" },
      },
      invoices: {
        orderBy: { invoiceDate: "desc" },
        take: 20,
      },
      contacts: {
        orderBy: { lastName: "asc" },
      },
      boardCards: {
        include: {
          column: { select: { id: true, name: true, color: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          tags: { include: { tag: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });
  }

  return NextResponse.json(client);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, string | null> = {};
  if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl;
  if (body.oxiboxId !== undefined) data.oxiboxId = body.oxiboxId || null;
  if (body.emsisoftId !== undefined) data.emsisoftId = body.emsisoftId || null;

  const client = await prisma.client.update({
    where: { id },
    data,
  });

  return NextResponse.json(client);
}
