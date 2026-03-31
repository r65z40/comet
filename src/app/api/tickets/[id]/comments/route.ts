import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendEmail, getSmtpConfig } from "@/lib/email";

// POST: Add comment to ticket
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { content, isInternal } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Contenu requis" }, { status: 400 });
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      clientUser: { select: { email: true, name: true } },
      client: { select: { name: true } },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket introuvable" }, { status: 404 });

  const comment = await prisma.ticketComment.create({
    data: {
      ticketId: id,
      content: content.trim(),
      authorName: session.user?.name || "Admin",
      authorEmail: session.user?.email || null,
      isInternal: isInternal || false,
      isFromClient: false,
    },
  });

  // Send email notification to client if not internal comment
  if (!isInternal && ticket.clientUser?.email) {
    const smtpConfig = await getSmtpConfig();
    if (smtpConfig) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px">
            <h2 style="color:#1e293b;margin-top:0">Nouvelle réponse à votre ticket</h2>
            <p style="color:#475569">Bonjour <strong>${ticket.clientUser.name}</strong>,</p>
            <p style="color:#475569">Une nouvelle réponse a été ajoutée à votre ticket :</p>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0">
              <p style="color:#64748b;font-size:13px;margin:0 0 4px">Ticket : <strong>${ticket.title}</strong></p>
              <div style="color:#1e293b;margin-top:8px">${content}</div>
            </div>
            <p style="color:#94a3b8;font-size:13px">Connectez-vous à votre espace client pour répondre.</p>
          </div>
        </div>
      `;
      sendEmail(
        [ticket.clientUser.email],
        `Réponse à votre ticket : ${ticket.title}`,
        html
      ).catch((err) => console.error("Email notification error:", err));
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
