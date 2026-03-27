import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/knowledge/clients — list clients for article assignment
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const clients = await prisma.client.findMany({
    select: { id: true, name: true, logoUrl: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(clients);
}
