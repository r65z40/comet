import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = session.user?.id || "default";
  const setting = await prisma.setting.findUnique({
    where: { key: `dashboard_layout_${userId}` },
  });

  if (!setting) {
    return NextResponse.json({ layout: null });
  }

  try {
    return NextResponse.json({ layout: JSON.parse(setting.value) });
  } catch {
    return NextResponse.json({ layout: null });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = session.user?.id || "default";
  const body = await req.json();
  const { panels } = body;

  if (!Array.isArray(panels)) {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  }

  await prisma.setting.upsert({
    where: { key: `dashboard_layout_${userId}` },
    create: { key: `dashboard_layout_${userId}`, value: JSON.stringify(panels) },
    update: { value: JSON.stringify(panels) },
  });

  return NextResponse.json({ success: true });
}
