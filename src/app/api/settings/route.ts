import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const settings = await prisma.setting.findMany();
  const settingsMap: Record<string, string> = {};
  settings.forEach((s) => {
    if (s.key === "axonaut_api_key" || s.key === "smtp_pass") {
      settingsMap[s.key] = s.value ? "••••••••" + s.value.slice(-4) : "";
    } else {
      settingsMap[s.key] = s.value;
    }
  });

  return NextResponse.json(settingsMap);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();

  for (const [key, value] of Object.entries(body)) {
    if ((key === "axonaut_api_key" || key === "smtp_pass") && (value as string).startsWith("••••")) continue;

    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as string },
      update: { value: value as string },
    });
  }

  return NextResponse.json({ success: true });
}
