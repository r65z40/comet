import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes, createHash } from "crypto";
import { sendEmail, getSmtpConfig } from "@/lib/email";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

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

      // Generate secure token — store SHA-256 hash in DB, send raw token in email
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: tokenHash,
          expiresAt,
        },
      });

      // Build reset URL from server-side config to prevent host header injection
      const baseUrl = (process.env.AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      // Send email
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <div style="text-align:center;margin-bottom:30px">
            <h1 style="color:#1e293b;font-size:24px;margin:0">COMET <span style="font-weight:300;color:#2563eb">- CEDELIA</span></h1>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:32px">
            <h2 style="color:#1e293b;margin-top:0">Réinitialisation de mot de passe</h2>
            <p style="color:#475569">Bonjour <strong>${escapeHtml(user.name)}</strong>,</p>
            <p style="color:#475569">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${escapeHtml(resetUrl)}" style="background:#2563eb;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color:#94a3b8;font-size:13px">Ce lien expire dans <strong>1 heure</strong>.</p>
            <p style="color:#94a3b8;font-size:13px">Si vous n'avez pas fait cette demande, ignorez cet email.</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
            <p style="color:#cbd5e1;font-size:11px">Lien direct : ${escapeHtml(resetUrl)}</p>
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
    console.error("Forgot-password error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
