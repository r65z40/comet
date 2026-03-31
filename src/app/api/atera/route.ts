import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testAteraConnection } from "@/lib/atera";

// POST: Test Atera connection
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { action } = await req.json();

  if (action === "test") {
    const result = await testAteraConnection();
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
