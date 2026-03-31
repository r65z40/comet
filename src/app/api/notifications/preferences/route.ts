import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserPreferences } from "@/lib/notifications";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const prefs = await getUserPreferences(session.user.id);
  return NextResponse.json(prefs);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();

  const allowedFields = [
    "cardAssigned", "cardComment", "cardMoved", "cardArchived", "cardDueDate",
    "ticketNew", "ticketReply",
    "emailCardAssigned", "emailCardComment", "emailTicketNew", "emailTicketReply",
    "muteAll", "emailEnabled",
  ];

  const data: Record<string, boolean> = {};
  for (const field of allowedFields) {
    if (typeof body[field] === "boolean") {
      data[field] = body[field];
    }
  }

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });

  return NextResponse.json(prefs);
}
