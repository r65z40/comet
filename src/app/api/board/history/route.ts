import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cardId = searchParams.get("cardId");

  if (!cardId) return NextResponse.json({ error: "cardId requis" }, { status: 400 });

  const history = await prisma.cardHistory.findMany({
    where: { cardId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(history);
}
