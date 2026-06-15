import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  await prisma.setting.deleteMany({
    where: {
      key: { in: ["spotify_access_token", "spotify_refresh_token", "spotify_token_expires"] },
    },
  });

  return NextResponse.json({ success: true });
}
