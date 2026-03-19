import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || "",
      }
    : undefined,
});

const FROM = process.env.SMTP_FROM || "noreply@comet.local";

export async function sendInviteEmail({
  to,
  userName,
  clientName,
  inviteUrl,
}: {
  to: string;
  userName: string;
  clientName: string;
  inviteUrl: string;
}) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "COMET";

  await transporter.sendMail({
    from: `"${appName}" <${FROM}>`,
    to,
    subject: `Invitation - Espace client ${clientName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
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
    `,
  });
}
