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

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: true,
      lines: {
        include: {
          product: { select: { id: true, name: true, code: true, family: true, supplier: true, durationMonths: true } },
        },
      },
      installations: {
        select: {
          id: true,
          invoiceLineId: true,
          startDate: true,
          endDate: true,
          durationMonths: true,
          status: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
  }

  return NextResponse.json(invoice);
}
