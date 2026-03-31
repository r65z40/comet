import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET: Returns recent unread ticket notifications (last 2 minutes)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json([], { status: 401 });
  }

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  const notifications = await prisma.notification.findMany({
    where: {
      userId: session.user.id,
      type: { in: ["ticket_new", "ticket_reply"] },
      read: false,
      createdAt: { gte: twoMinutesAgo },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return NextResponse.json(notifications);
}
