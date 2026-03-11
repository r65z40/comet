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

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      installations: {
        include: {
          client: { select: { id: true, name: true } },
          invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true } },
        },
        orderBy: { endDate: "asc" },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Produit non trouvé" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  // Delete related installations first
  await prisma.installation.deleteMany({ where: { productId: id } });
  // Delete related invoice lines
  await prisma.invoiceLine.deleteMany({ where: { productId: id } });
  // Delete the product
  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
