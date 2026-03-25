import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET portal settings + users for a client
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;

  const [portalSettings, portalUsers] = await Promise.all([
    prisma.clientPortalSettings.findUnique({ where: { clientId: id } }),
    prisma.clientUser.findMany({
      where: { clientId: id },
      select: { id: true, name: true, email: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ portalSettings, portalUsers });
}

// PUT - update portal settings
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const data = {
    primaryColor: body.primaryColor || "#3b82f6",
    headerLogo: body.headerLogo || null,
    welcomeMessage: body.welcomeMessage || null,
    welcomeTitle: body.welcomeTitle || null,
    welcomeContent: body.welcomeContent || null,
    showStats: body.showStats ?? true,
    showExpiring: body.showExpiring ?? true,
    showFamily: body.showFamily ?? true,
    showSupplier: body.showSupplier ?? true,
    showDuration: body.showDuration ?? true,
    showQuantity: body.showQuantity ?? false,
    showComParc: body.showComParc ?? false,
    showHeaderRow: body.showHeaderRow ?? true,
    footerText: body.footerText || null,
  };

  const portalSettings = await prisma.clientPortalSettings.upsert({
    where: { clientId: id },
    update: data,
    create: { clientId: id, ...data },
  });

  return NextResponse.json(portalSettings);
}
