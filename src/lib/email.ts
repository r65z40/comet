import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          "smtp_host",
          "smtp_port",
          "smtp_secure",
          "smtp_user",
          "smtp_pass",
          "smtp_from",
        ],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  if (!map.smtp_host || !map.smtp_user || !map.smtp_pass) return null;

  return {
    host: map.smtp_host,
    port: parseInt(map.smtp_port || "587"),
    secure: map.smtp_secure === "true",
    user: map.smtp_user,
    pass: map.smtp_pass,
    from: map.smtp_from || map.smtp_user,
  };
}

export async function getNotificationConfig() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: ["notification_emails", "notification_delay_days"],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  return {
    emails: (map.notification_emails || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean),
    delayDays: parseInt(map.notification_delay_days || "30"),
  };
}

function createTransporter(config: SmtpConfig) {
  // IMPORTANT: "secure" in Nodemailer means IMPLICIT TLS (direct TLS connection)
  // - Port 465 → secure: true  (implicit TLS)
  // - Port 587 → secure: false (STARTTLS - negotiates TLS after plain connection)
  // - Port 25  → secure: false (plain or STARTTLS)
  // Setting secure: true on port 587 causes "wrong version number" SSL error
  const useSecure = config.port === 465;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: useSecure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendEmail(to: string[], subject: string, html: string) {
  const config = await getSmtpConfig();
  if (!config) throw new Error("SMTP non configuré");

  const transporter = createTransporter(config);

  await transporter.sendMail({
    from: config.from,
    to: to.join(", "),
    subject,
    html,
  });
}

export async function testSmtpConnection(providedConfig?: SmtpConfig): Promise<{ success: boolean; error?: string }> {
  const config = providedConfig || await getSmtpConfig();
  if (!config) return { success: false, error: "SMTP non configuré" };

  if (!config.host || !config.user || !config.pass) {
    return { success: false, error: "Serveur, identifiant et mot de passe sont requis" };
  }

  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur de connexion" };
  }
}

function getParisNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
}

export async function sendExpiryNotifications() {
  const { emails, delayDays } = await getNotificationConfig();
  if (emails.length === 0) return { sent: false, reason: "Aucun email destinataire configuré" };

  const baseUrl = (process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const now = getParisNow();
  const future = new Date(now);
  future.setDate(future.getDate() + delayDays);

  const installations = await prisma.installation.findMany({
    where: {
      status: { not: "RENOUVELE" },
      endDate: { gte: now, lte: future },
    },
    include: {
      client: { select: { id: true, name: true } },
      product: { select: { name: true } },
    },
    orderBy: { endDate: "asc" },
  });

  if (installations.length === 0) {
    return { sent: false, reason: "Aucune échéance dans les prochains jours" };
  }

  const rows = installations
    .map((i) => {
      const daysLeft = Math.ceil(
        (new Date(i.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const color = daysLeft <= 7 ? "#ef4444" : daysLeft <= 30 ? "#f97316" : "#eab308";
      const clientUrl = `${baseUrl}/clients/${i.client.id}`;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0"><a href="${clientUrl}" style="color:#2563eb;text-decoration:none">${i.client.name}</a></td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${i.product.name}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${new Date(i.endDate).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:${color};font-weight:bold">${daysLeft}j</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
      <h2 style="color:#1e293b">COMET CEDELIA - Alertes fin de garantie</h2>
      <p style="color:#64748b">${installations.length} installation(s) arrivent à échéance dans les ${delayDays} prochains jours.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:8px;text-align:left;border-bottom:2px solid #cbd5e1">Client</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #cbd5e1">Produit</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #cbd5e1">Fin garantie</th>
            <th style="padding:8px;text-align:left;border-bottom:2px solid #cbd5e1">Restant</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">
        Email envoyé automatiquement par COMET CEDELIA
      </p>
    </div>
  `;

  await sendEmail(
    emails,
    `[COMET] ${installations.length} garantie(s) expirent dans ${delayDays} jours`,
    html
  );

  return { sent: true, count: installations.length };
}
