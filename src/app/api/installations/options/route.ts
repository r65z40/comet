import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [families, suppliers] = await Promise.all([
    prisma.installation.findMany({
      where: { family: { not: null }, deletedAt: null },
      select: { family: true },
      distinct: ["family"],
      orderBy: { family: "asc" },
    }),
    prisma.installation.findMany({
      where: { supplier: { not: null }, deletedAt: null },
      select: { supplier: true },
      distinct: ["supplier"],
      orderBy: { supplier: "asc" },
    }),
  ]);

  return NextResponse.json({
    families: families.map((f) => f.family).filter(Boolean),
    suppliers: suppliers.map((s) => s.supplier).filter(Boolean),
  });
}
