import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-auth";
import { syncTicketToAtera, getAteraConfig } from "@/lib/atera";
import { sendEmail, getSmtpConfig } from "@/lib/email";
import { notifyAdmins } from "@/lib/notifications";
import { escapeHtml } from "@/lib/utils";

// GET: List client's tickets
export async function GET(req: NextRequest) {
  const payload = await verifyPortalToken();
  if (!payload) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {
    clientId: payload.clientId,
  };
  if (status && status !== "all") where.status = status;

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tickets);
}

// POST: Create a ticket from the portal
export async function POST(req: NextRequest) {
  const payload = await verifyPortalToken();
  if (!payload) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const { title, description, priority, type } = await req.json();

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Titre et description requis" }, { status: 400 });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        priority: priority || "Medium",
        type: type || "Incident",
        clientId: payload.clientId,
        clientUserId: payload.sub,
      },
    });

    // Add first comment with description
    await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        content: description.trim(),
        authorName: payload.name,
        authorEmail: payload.email,
        isFromClient: true,
      },
    });

    // Sync to Atera if configured
    const config = await getAteraConfig();
    if (config?.enabled) {
      syncTicketToAtera(ticket.id).catch((err) =>
        console.error("Atera sync error:", err)
      );
    }

    // Notify admins by email
    const smtpConfig = await getSmtpConfig();
    if (smtpConfig) {
      const notifSetting = await prisma.setting.findUnique({
        where: { key: "notification_emails" },
      });
      const adminEmails = notifSetting?.value
        ?.split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (adminEmails?.length) {
        const client = await prisma.client.findUnique({
          where: { id: payload.clientId },
          select: { name: true },
        });

        const priorityColors: Record<string, string> = {
          Low: "#22c55e",
          Medium: "#f59e0b",
          High: "#f97316",
          Critical: "#ef4444",
        };

        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
              <h2 style="color:#1e293b;margin-top:0">Nouveau ticket client</h2>
              <p style="color:#475569"><strong>${escapeHtml(payload.name)}</strong> (${escapeHtml(client?.name || "Client")}) a ouvert un ticket :</p>
              <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
                <p style="margin:0 0 8px"><strong style="color:#1e293b">${escapeHtml(title)}</strong></p>
                <p style="color:#64748b;font-size:13px;margin:0 0 4px">
                  Priorité : <span style="color:${priorityColors[priority] || "#64748b"};font-weight:bold">${escapeHtml(priority || "Medium")}</span>
                  &nbsp;—&nbsp;Type : ${escapeHtml(type || "Incident")}
                </p>
                <div style="color:#475569;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0">${escapeHtml(description)}</div>
              </div>
            </div>
          </div>
        `;

        sendEmail(
          adminEmails,
          `[Ticket] ${title.replace(/[<>]/g, "")} — ${(client?.name || "Client").replace(/[<>]/g, "")}`,
          html
        ).catch((err) => console.error("Email notification error:", err));
      }
    }

    // Notify admins in-app
    notifyAdmins({
      type: "ticket_new",
      title: "Nouveau ticket client",
      message: `${payload.name} a ouvert le ticket : ${title}`,
      link: `/tickets/${ticket.id}`,
    }).catch((err) => console.error("In-app notification error:", err));

    // Log activity
    await prisma.activityLog.create({
      data: {
        userName: payload.name,
        action: "CREATE",
        entity: "ticket",
        entityId: ticket.id,
        details: `Ticket client : ${title}`,
      },
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
