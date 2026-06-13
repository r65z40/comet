import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// ─── French descriptions ────────────────────────────────────────────────────

const ENTITY_ARTICLES: Record<string, { un: string; une?: string }> = {
  client: { un: "un client" },
  product: { un: "un produit" },
  installation: { un: "", une: "une installation" },
  invoice: { un: "", une: "une facture" },
  user: { un: "un utilisateur" },
  settings: { un: "les paramètres" },
  contact: { un: "un contact" },
};

const ACTION_VERBS: Record<string, string> = {
  CREATE: "a créé",
  UPDATE: "a modifié",
  DELETE: "a supprimé",
  RESTORE: "a restauré",
  EXPORT: "a exporté",
  SYNC: "a synchronisé",
  BULK_DELETE: "a supprimé en masse",
  BULK_UPDATE: "a modifié en masse",
};

function activityTitle(action: string, entity: string): string {
  const verb = ACTION_VERBS[action] || action.toLowerCase();
  const article = ENTITY_ARTICLES[entity];
  if (article) {
    const noun = article.une || article.un;
    return `${verb} ${noun}`;
  }
  return `${verb} ${entity}`;
}

function cardHistoryTitle(action: string, newValue?: string | null): string {
  switch (action) {
    case "MOVE":
      return `a déplacé une carte vers ${newValue || "une colonne"}`;
    case "COMMENT":
      return "a commenté une carte";
    case "ASSIGN":
      return "a assigné une carte";
    case "CREATE":
      return "a créé une carte";
    case "UPDATE":
      return "a modifié une carte";
    case "DELETE":
      return "a supprimé une carte";
    case "ATTACHMENT":
      return "a ajouté une pièce jointe à une carte";
    default:
      return `a effectué l'action ${action} sur une carte`;
  }
}

// ─── Feed item type ─────────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  type: "activity" | "card" | "ticket_comment" | "card_comment";
  action: string;
  userName: string;
  entity: string;
  entityId: string;
  title: string;
  detail?: string;
  date: string;
}

// ─── GET handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30") || 30));
  const before = searchParams.get("before");

  const dateFilter = before ? { lt: new Date(before) } : undefined;

  try {
    // Fetch from all four sources in parallel
    const [activityLogs, cardHistories, ticketComments, cardComments] = await Promise.all([
      // 1. ActivityLog entries
      prisma.activityLog.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),

      // 2. CardHistory entries
      prisma.cardHistory.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          card: { select: { id: true, title: true } },
        },
      }),

      // 3. TicketComments (non-internal only)
      prisma.ticketComment.findMany({
        where: {
          isInternal: false,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          ticket: { select: { id: true, title: true } },
        },
      }),

      // 4. CardComments
      prisma.cardComment.findMany({
        where: dateFilter ? { createdAt: dateFilter } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          card: { select: { id: true, title: true } },
        },
      }),
    ]);

    // Transform each source into FeedItem[]
    const feedItems: FeedItem[] = [];

    for (const log of activityLogs) {
      feedItems.push({
        id: log.id,
        type: "activity",
        action: log.action,
        userName: log.userName || "Système",
        entity: log.entity,
        entityId: log.entityId || "",
        title: activityTitle(log.action, log.entity),
        detail: log.details || undefined,
        date: log.createdAt.toISOString(),
      });
    }

    for (const h of cardHistories) {
      feedItems.push({
        id: h.id,
        type: "card",
        action: h.action,
        userName: h.userName || "Système",
        entity: "card",
        entityId: h.cardId,
        title: cardHistoryTitle(h.action, h.newValue),
        detail: h.card?.title || undefined,
        date: h.createdAt.toISOString(),
      });
    }

    for (const tc of ticketComments) {
      feedItems.push({
        id: tc.id,
        type: "ticket_comment",
        action: "COMMENT",
        userName: tc.authorName,
        entity: "ticket",
        entityId: tc.ticketId,
        title: `a répondu au ticket ${tc.ticket?.title || ""}`.trim(),
        detail: tc.ticket?.title || undefined,
        date: tc.createdAt.toISOString(),
      });
    }

    for (const cc of cardComments) {
      feedItems.push({
        id: cc.id,
        type: "card_comment",
        action: "COMMENT",
        userName: cc.userName,
        entity: "card",
        entityId: cc.cardId,
        title: `a commenté la carte ${cc.card?.title || ""}`.trim(),
        detail: cc.card?.title || undefined,
        date: cc.createdAt.toISOString(),
      });
    }

    // Sort by date descending and take the limit
    feedItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const result = feedItems.slice(0, limit);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
