import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export interface TimelineEvent {
  id: string;
  type: "installation" | "installation_change" | "invoice" | "ticket" | "ticket_comment" | "board_card" | "activity";
  date: string;
  title: string;
  detail?: string;
  meta?: Record<string, string>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));

  const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });

  const [installations, installationHistories, invoices, tickets, ticketComments, boardCards, activities] = await Promise.all([
    prisma.installation.findMany({
      where: { clientId: id, deletedAt: null },
      select: { id: true, createdAt: true, status: true, product: { select: { name: true } }, startDate: true, endDate: true },
      orderBy: { createdAt: "desc" },
    }),

    prisma.installationHistory.findMany({
      where: { installation: { clientId: id, deletedAt: null } },
      select: { id: true, createdAt: true, field: true, oldValue: true, newValue: true, changedBy: true, installation: { select: { product: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),

    prisma.invoice.findMany({
      where: { clientId: id },
      select: { id: true, invoiceNumber: true, invoiceDate: true, totalAmount: true, status: true, createdAt: true },
      orderBy: { invoiceDate: "desc" },
      take: limit,
    }),

    prisma.ticket.findMany({
      where: { clientId: id },
      select: { id: true, title: true, status: true, priority: true, createdAt: true, resolvedAt: true, closedAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),

    prisma.ticketComment.findMany({
      where: { ticket: { clientId: id }, isInternal: false },
      select: { id: true, createdAt: true, authorName: true, ticket: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),

    prisma.boardCard.findMany({
      where: { clientId: id },
      select: { id: true, title: true, createdAt: true, updatedAt: true, column: { select: { name: true, color: true } }, priority: true, archived: true, archivedAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),

    prisma.activityLog.findMany({
      where: { entity: "client", entityId: id },
      select: { id: true, action: true, userName: true, details: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const FIELD_LABELS: Record<string, string> = {
    status: "Statut",
    endDate: "Date de fin",
    startDate: "Date de début",
    supplier: "Fournisseur",
    family: "Famille",
    quantity: "Quantité",
    durationMonths: "Durée",
    comParc: "Com. Parc",
    alwaysInFleet: "Toujours en parc",
  };

  const STATUS_LABELS: Record<string, string> = {
    EN_PARC: "En parc",
    HORS_PARC: "Hors parc",
    RENOUVELE: "Renouvelé",
  };

  const events: TimelineEvent[] = [];

  for (const inst of installations) {
    events.push({
      id: `inst-${inst.id}`,
      type: "installation",
      date: inst.createdAt.toISOString(),
      title: `Installation ajoutée : ${inst.product.name}`,
      meta: { status: inst.status, installationId: inst.id },
    });
  }

  for (const h of installationHistories) {
    const fieldLabel = FIELD_LABELS[h.field] || h.field;
    const oldVal = (h.field === "status" ? STATUS_LABELS[h.oldValue || ""] : h.oldValue) || "—";
    const newVal = (h.field === "status" ? STATUS_LABELS[h.newValue || ""] : h.newValue) || "—";
    events.push({
      id: `insth-${h.id}`,
      type: "installation_change",
      date: h.createdAt.toISOString(),
      title: `${fieldLabel} modifié sur ${h.installation.product.name}`,
      detail: `${oldVal} → ${newVal}`,
      meta: { changedBy: h.changedBy || "Système" },
    });
  }

  for (const inv of invoices) {
    const amount = inv.totalAmount ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(inv.totalAmount) : "";
    events.push({
      id: `inv-${inv.id}`,
      type: "invoice",
      date: (inv.invoiceDate || inv.createdAt).toISOString(),
      title: `Facture ${inv.invoiceNumber || "sans numéro"}`,
      detail: amount || undefined,
      meta: { status: inv.status || "", invoiceId: inv.id },
    });
  }

  for (const t of tickets) {
    events.push({
      id: `tkt-${t.id}`,
      type: "ticket",
      date: t.createdAt.toISOString(),
      title: `Ticket ouvert : ${t.title}`,
      meta: { status: t.status, priority: t.priority, ticketId: t.id },
    });
    if (t.resolvedAt) {
      events.push({
        id: `tkt-res-${t.id}`,
        type: "ticket",
        date: t.resolvedAt.toISOString(),
        title: `Ticket résolu : ${t.title}`,
        meta: { status: "Resolved", ticketId: t.id },
      });
    }
    if (t.closedAt) {
      events.push({
        id: `tkt-cls-${t.id}`,
        type: "ticket",
        date: t.closedAt.toISOString(),
        title: `Ticket fermé : ${t.title}`,
        meta: { status: "Closed", ticketId: t.id },
      });
    }
  }

  for (const tc of ticketComments) {
    events.push({
      id: `tktc-${tc.id}`,
      type: "ticket_comment",
      date: tc.createdAt.toISOString(),
      title: `${tc.authorName} a répondu au ticket`,
      detail: tc.ticket.title,
      meta: { ticketId: tc.ticket.id },
    });
  }

  for (const card of boardCards) {
    events.push({
      id: `card-${card.id}`,
      type: "board_card",
      date: card.createdAt.toISOString(),
      title: `Carte créée : ${card.title}`,
      meta: { column: card.column.name, columnColor: card.column.color, cardId: card.id },
    });
    if (card.archived && card.archivedAt) {
      events.push({
        id: `card-arch-${card.id}`,
        type: "board_card",
        date: card.archivedAt.toISOString(),
        title: `Carte archivée : ${card.title}`,
        meta: { cardId: card.id },
      });
    }
  }

  for (const a of activities) {
    const VERBS: Record<string, string> = { CREATE: "Création", UPDATE: "Modification", DELETE: "Suppression", SYNC: "Synchronisation" };
    events.push({
      id: `act-${a.id}`,
      type: "activity",
      date: a.createdAt.toISOString(),
      title: `${VERBS[a.action] || a.action} du client`,
      detail: a.details || undefined,
      meta: { userName: a.userName || "Système" },
    });
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json(events.slice(0, limit));
}
