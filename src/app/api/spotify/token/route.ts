import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidToken } from "@/lib/spotify";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const token = await getValidToken();
    return NextResponse.json({ token });
  } catch {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }
}
