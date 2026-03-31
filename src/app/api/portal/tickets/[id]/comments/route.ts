import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-auth";
import { sendEmail, getSmtpConfig } from "@/lib/email";

// POST: Client adds a comment to their ticket
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const payload = await verifyPortalToken();
  if (!payload) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Contenu requis" }, { status: 400 });
  }

  // Verify ticket belongs to client
  const ticket = await prisma.ticket.findFirst({
    where: { id, clientId: payload.clientId },
    include: { client: { select: { name: true } } },
  });

  if (!ticket) {
    return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });
  }

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: id,
      content: content.trim(),
      authorName: payload.name,
      authorEmail: payload.email,
      isFromClient: true,
    },
  });

  // Reopen ticket if it was resolved/closed
  if (ticket.status === "Resolved" || ticket.status === "Closed") {
    await prisma.ticket.update({
      where: { id },
      data: { status: "Open", resolvedAt: null, closedAt: null },
    });
  }

  // Notify admins
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
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
            <h2 style="color:#1e293b;margin-top:0">Nouvelle réponse client</h2>
            <p style="color:#475569"><strong>${payload.name}</strong> (${ticket.client.name}) a répondu au ticket :</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
              <p style="color:#64748b;font-size:13px;margin:0 0 8px">Ticket : <strong>${ticket.title}</strong></p>
              <div style="color:#1e293b">${content}</div>
            </div>
          </div>
        </div>
      `;

      sendEmail(
        adminEmails,
        `[Ticket] Réponse : ${ticket.title} — ${ticket.client.name}`,
        html
      ).catch((err) => console.error("Email notification error:", err));
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
