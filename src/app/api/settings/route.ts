import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const MASKED_KEYS = new Set(["axonaut_api_key", "smtp_pass", "cloud_s3_secret_key", "cloud_ftp_password", "oxibox_api_key", "emsisoft_api_key"]);

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const isAdmin = session.user?.role === "ADMIN";
  const settings = await prisma.setting.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) {
    if (MASKED_KEYS.has(s.key)) {
      // Only admins see masked secrets; non-admins see nothing
      if (isAdmin) {
        settingsMap[s.key] = s.value ? "••••••••" + s.value.slice(-4) : "";
      }
    } else {
      settingsMap[s.key] = s.value;
    }
  }

  return NextResponse.json(settingsMap);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }

  const operations = Object.entries(body)
    .filter(([key, value]) => typeof key === "string" && typeof value === "string" && !(MASKED_KEYS.has(key) && (value as string).startsWith("••••")))
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
