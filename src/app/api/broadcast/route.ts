import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const [messageSetting, enabledSetting] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "broadcast_message" } }),
    prisma.setting.findUnique({ where: { key: "broadcast_enabled" } }),
  ]);

  const enabled = enabledSetting?.value === "true";
  const message = messageSetting?.value || "";

  return NextResponse.json({ enabled, message });
}
