import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { sendEmail, getSmtpConfig } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    // Check SMTP is configured
    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig) {
      return NextResponse.json(
        { error: "Le serveur mail n'est pas configuré. Contactez votre administrateur." },
        { status: 503 }
      );
    }

    // Find user - don't reveal if email exists or not (security)
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Invalidate any existing unused tokens for this user
      await prisma.passwordReset.updateMany({
        where: { userId: user.id, used: false },
        data: { used: true },
      });

      // Generate secure token
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Build reset URL
      const baseUrl = req.headers.get("origin") || req.headers.get("x-forwarded-host") || "http://localhost:3000";
      const protocol = req.headers.get("x-forwarded-proto") || "http";
      const host = req.headers.get("host") || "localhost:3000";
      const resetUrl = req.headers.get("origin")
        ? `${baseUrl}/reset-password?token=${token}`
        : `${protocol}://${host}/reset-password?token=${token}`;

      // Send email
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="text-align:center;margin-bottom:30px">
            <h1 style="color:#1e293b;font-size:24px;margin:0">COMET <span style="font-weight:300;color:#2563eb">- CEDELIA</span></h1>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
            <h2 style="color:#1e293b;margin-top:0">Réinitialisation de mot de passe</h2>
            <p style="color:#475569">Bonjour <strong>${user.name}</strong>,</p>
            <p style="color:#475569">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${resetUrl}" style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px">Ce lien expire dans <strong>1 heure</strong>.</p>
            <p style="color:#94a3b8;font-size:13px">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
            <p style="color:#cbd5e1;font-size:11px">Lien direct : ${resetUrl}</p>
          </div>
          <p style="color:#94a3b8;font-size:11px;text-align:center;margin-top:24px">
            COMET CEDELIA — Gestion des garanties et installations
          </p>
        </div>
      `;

      await sendEmail(
        [user.email],
        "[COMET] Réinitialisation de mot de passe",
        html
      );
    }

    // Always return success (don't reveal if email exists)
    return NextResponse.json({
      success: true,
      message: "Si cette adresse existe, un email de réinitialisation a été envoyé.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
