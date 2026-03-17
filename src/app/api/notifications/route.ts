import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testSmtpConnection, sendExpiryNotifications, sendEmail, getNotificationConfig, getSmtpConfig } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();

  if (body.action === "test") {
    // Use provided SMTP config from form if available
    const config = body.smtp
      ? {
          host: body.smtp.host,
          port: parseInt(body.smtp.port || "587"),
          secure: body.smtp.secure === true || body.smtp.secure === "true",
          user: body.smtp.user,
          pass: body.smtp.pass,
          from: body.smtp.from || body.smtp.user,
        }
      : undefined;

    const result = await testSmtpConnection(config);
    return NextResponse.json(result);
  }

  if (body.action === "send") {
    try {
      const result = await sendExpiryNotifications();
      const parisTime = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      return NextResponse.json({ ...result, parisTime });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur d'envoi";
      const stack = err instanceof Error ? err.stack : undefined;
      return NextResponse.json(
        { error: message, details: stack },
        { status: 500 }
      );
    }
  }

  // Send a test email to verify the full SMTP pipeline works
  if (body.action === "test-email") {
    try {
      const smtp = await getSmtpConfig();
      if (!smtp) {
        return NextResponse.json({ error: "SMTP non configuré. Configurez d'abord le serveur mail." }, { status: 400 });
      }

      const { emails } = await getNotificationConfig();
      const recipients = emails.length > 0 ? emails : [session.user?.email].filter(Boolean) as string[];
      if (recipients.length === 0) {
        return NextResponse.json({ error: "Aucun destinataire configuré. Ajoutez des emails dans la section notifications." }, { status: 400 });
      }

      const parisTime = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
          <h2 style="color:#1e293b">COMET CEDELIA - Email de test</h2>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:16px 0">
            <p style="color:#166534;font-size:16px;font-weight:bold;margin:0">La configuration SMTP fonctionne correctement !</p>
          </div>
          <p style="color:#475569">Cet email a été envoyé depuis COMET CEDELIA pour vérifier la configuration mail.</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
            <tr><td style="padding:6px 0;color:#94a3b8">Serveur SMTP</td><td style="padding:6px 0;color:#1e293b">${smtp.host}:${smtp.port}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8">Expéditeur</td><td style="padding:6px 0;color:#1e293b">${smtp.from}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8">Destinataire(s)</td><td style="padding:6px 0;color:#1e293b">${recipients.join(", ")}</td></tr>
            <tr><td style="padding:6px 0;color:#94a3b8">Heure Paris</td><td style="padding:6px 0;color:#1e293b">${parisTime}</td></tr>
          </table>
          <p style="color:#94a3b8;font-size:11px;margin-top:24px">COMET CEDELIA</p>
        </div>
      `;

      await sendEmail(recipients, "[COMET] Email de test - Configuration OK", html);
      return NextResponse.json({
        success: true,
        message: `Email de test envoyé à ${recipients.join(", ")}`,
        parisTime,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur d'envoi";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}
