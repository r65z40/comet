import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const now = new Date();
  const future = new Date(now);
  future.setDate(future.getDate() + 30);

  const installations = await prisma.installation.findMany({
    where: {
      status: { not: "RENOUVELE" },
      endDate: { gte: now, lte: future },
    },
    include: {
      client: { select: { id: true, name: true } },
      product: { select: { name: true } },
    },
    orderBy: { endDate: "asc" },
    take: 20,
  });

  const items = installations.map((i) => {
    const daysLeft = Math.ceil(
      (new Date(i.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: i.id,
      clientName: i.client.name,
      clientId: i.client.id,
      productName: i.product.name,
      endDate: i.endDate,
      daysLeft,
    };
  });

  return NextResponse.json({ count: items.length, items });
}
