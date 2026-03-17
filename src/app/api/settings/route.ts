import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const MASKED_KEYS = new Set(["axonaut_api_key", "smtp_pass"]);

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const settings = await prisma.setting.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    settingsMap[s.key] = MASKED_KEYS.has(s.key) && s.value
      ? "••••••••" + s.value.slice(-4)
      : s.value;
  }

  return NextResponse.json(settingsMap);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();

  const operations = Object.entries(body)
    .filter(([key, value]) => !(MASKED_KEYS.has(key) && (value as string).startsWith("••••")))
    .map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: value as string },
        update: { value: value as string },
      })
    );

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  return NextResponse.json({ success: true });
}
