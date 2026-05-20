import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const [clients, products, installations] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 5,
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { family: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, code: true, family: true },
      take: 5,
    }),
    prisma.installation.findMany({
      where: {
        deletedAt: null,
        OR: [
          { product: { name: { contains: q, mode: "insensitive" } } },
          { client: { name: { contains: q, mode: "insensitive" } } },
          { family: { contains: q, mode: "insensitive" } },
          { supplier: { contains: q, mode: "insensitive" } },
          { comParc: { contains: q, mode: "insensitive" } },
        ],
      },
      include: {
        client: { select: { name: true } },
        product: { select: { name: true } },
      },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    results: [
      ...clients.map((c) => ({ type: "client" as const, id: c.id, title: c.name, subtitle: c.email })),
      ...products.map((p) => ({ type: "product" as const, id: p.id, title: p.name, subtitle: p.family })),
      ...installations.map((i) => ({
        type: "installation" as const,
        id: i.id,
        title: i.product.name,
        subtitle: i.client.name,
      })),
    ],
  });
}
