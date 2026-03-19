import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email";

function buildInviteEmailHtml(userName: string, clientName: string, inviteUrl: string, companyLogo?: string | null, clientLogo?: string | null): string {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "COMET";
  const logosHtml = (companyLogo || clientLogo)
    ? `<div style="text-align: center; margin-bottom: 24px;">
        ${companyLogo ? `<img src="${companyLogo}" alt="${appName}" style="max-height: 48px; max-width: 180px; object-fit: contain; margin: 0 8px;" />` : ""}
        ${clientLogo ? `<img src="${clientLogo}" alt="${clientName}" style="max-height: 48px; max-width: 180px; object-fit: contain; margin: 0 8px;" />` : ""}
      </div>`
    : "";
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        ${logosHtml}
        <h1 style="color: #1e293b; font-size: 24px; margin: 0;">${appName}</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 16px;">Bonjour ${userName},</h2>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
          Vous avez été invité(e) à accéder à l'espace client de <strong>${clientName}</strong>.
        </p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
          Cliquez sur le bouton ci-dessous pour créer votre mot de passe et activer votre compte :
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Activer mon compte
          </a>
        </div>
        <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 16px 0 0;">
          Ce lien est valable 7 jours. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px;" />
        <p style="color: #94a3b8; font-size: 11px; margin: 0;">
          Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
          <a href="${inviteUrl}" style="color: #3b82f6; word-break: break-all;">${inviteUrl}</a>
        </p>
      </div>
    </div>
  `;
}

// POST - generate an invitation token for a portal user and send email
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id, userId } = await params;

  const user = await prisma.clientUser.findFirst({
    where: { id: userId, clientId: id },
    include: { client: { select: { name: true, logoUrl: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.clientUser.update({
    where: { id: userId },
    data: { inviteToken: token, inviteTokenExpiry: expiry },
  });

  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const inviteUrl = `${origin}/portal/setup?token=${token}`;

  // Fetch company logo for email branding
  const companyLogoSetting = await prisma.setting.findUnique({ where: { key: "company_logo" } });

  // Send invitation email using SMTP configured in settings
  let emailSent = false;
  try {
    const html = buildInviteEmailHtml(user.name, user.client.name, inviteUrl, companyLogoSetting?.value, user.client.logoUrl);
    await sendEmail([user.email], `Invitation - Espace client ${user.client.name}`, html);
    emailSent = true;
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }

  return NextResponse.json({ inviteUrl, expiresAt: expiry.toISOString(), emailSent });
}
