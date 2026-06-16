import { prisma } from "@/lib/db";
import { sendEmail, getSmtpConfig } from "@/lib/email";
import nodemailer from "nodemailer";

interface QuotaAlertConfig {
  enabled: boolean;
  warningThreshold: number;
  exceededThreshold: number;
  autoSend: boolean;
  repeatMode: "once" | "recurring";
  repeatDays: number;
  sendToPortalUsers: boolean;
  ccAdmins: boolean;
  adminEmails: string[];
  subjectWarning: string;
  subjectExceeded: string;
  bodyWarning: string;
  bodyExceeded: string;
  emailFooter: string;
  companyName: string;
}

const DEFAULT_SUBJECT_WARNING = "Votre espace de sauvegarde approche de sa limite";
const DEFAULT_SUBJECT_EXCEEDED = "Votre espace de sauvegarde est plein";
const DEFAULT_BODY_WARNING = "Bonjour {clientName},\n\nNous vous informons que votre espace de sauvegarde atteint {usagePercent}% de sa capacité ({currentUsage} utilisés sur {allocatedQuota} alloués).\n\nNous vous recommandons de vérifier vos données ou de nous contacter pour augmenter votre quota avant d'atteindre la limite.";
const DEFAULT_BODY_EXCEEDED = "Bonjour {clientName},\n\nVotre espace de sauvegarde a atteint {usagePercent}% de sa capacité ({currentUsage} utilisés sur {allocatedQuota} alloués).\n\nVos prochaines sauvegardes risquent d'échouer. Veuillez nous contacter rapidement pour augmenter votre quota.";
const DEFAULT_FOOTER = "Cet email a été envoyé automatiquement. Pour toute question, contactez votre prestataire informatique.";

export async function getQuotaAlertConfig(): Promise<QuotaAlertConfig> {
  const keys = [
    "quota_alert_enabled",
    "quota_alert_warning",
    "quota_alert_exceeded",
    "quota_alert_auto_send",
    "quota_alert_repeat_mode",
    "quota_alert_repeat_days",
    "quota_alert_send_to_portal_users",
    "quota_alert_cc_admins",
    "quota_alert_subject_warning",
    "quota_alert_subject_exceeded",
    "quota_alert_body_warning",
    "quota_alert_body_exceeded",
    "quota_alert_email_footer",
    "notification_emails",
    "company_name",
  ];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const m: Record<string, string> = {};
  for (const s of settings) m[s.key] = s.value;

  const adminEmails = (m.notification_emails || "")
    .split(",").map(e => e.trim()).filter(Boolean);

  return {
    enabled: m.quota_alert_enabled === "true",
    warningThreshold: parseInt(m.quota_alert_warning || "80"),
    exceededThreshold: parseInt(m.quota_alert_exceeded || "100"),
    autoSend: m.quota_alert_auto_send !== "false",
    repeatMode: (m.quota_alert_repeat_mode === "recurring" ? "recurring" : "once") as "once" | "recurring",
    repeatDays: parseInt(m.quota_alert_repeat_days || "7"),
    sendToPortalUsers: m.quota_alert_send_to_portal_users === "true",
    ccAdmins: m.quota_alert_cc_admins === "true",
    adminEmails,
    subjectWarning: m.quota_alert_subject_warning || DEFAULT_SUBJECT_WARNING,
    subjectExceeded: m.quota_alert_subject_exceeded || DEFAULT_SUBJECT_EXCEEDED,
    bodyWarning: m.quota_alert_body_warning || DEFAULT_BODY_WARNING,
    bodyExceeded: m.quota_alert_body_exceeded || DEFAULT_BODY_EXCEEDED,
    emailFooter: m.quota_alert_email_footer || DEFAULT_FOOTER,
    companyName: m.company_name || "COMET",
  };
}

export type AlertLevel = "warning" | "exceeded";

interface OrgQuotaInfo {
  organizationId: string;
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  portalUserEmails: string[];
  allocatedQuota: bigint | null;
  currentUsage: bigint | null;
  usagePercent: number;
  alertLevel: AlertLevel | null;
}

export async function getOrgsExceedingThresholds(
  warningPct: number,
  exceededPct: number,
): Promise<OrgQuotaInfo[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const snapshots = await prisma.oxiboxSnapshot.findMany({
    where: {
      date: { gte: new Date(today.getTime() - 2 * 86400000) },
      allocatedQuota: { not: null },
      currentUsage: { not: null },
    },
    orderBy: { date: "desc" },
    distinct: ["organizationId"],
  });

  const clients = await prisma.client.findMany({
    where: { oxiboxId: { not: null }, deletedAt: null },
    select: {
      id: true,
      oxiboxId: true,
      name: true,
      email: true,
      contacts: { select: { email: true }, where: { email: { not: null } } },
      portalUsers: { where: { active: true }, select: { email: true } },
    },
  });
  const clientMap = new Map(clients.map(c => [c.oxiboxId!, c]));

  const results: OrgQuotaInfo[] = [];

  for (const snap of snapshots) {
    if (!snap.allocatedQuota || !snap.currentUsage) continue;
    const allocated = Number(snap.allocatedQuota);
    if (allocated === 0) continue;

    const usage = Number(snap.currentUsage);
    const pct = (usage / allocated) * 100;

    let alertLevel: AlertLevel | null = null;
    if (pct >= exceededPct) alertLevel = "exceeded";
    else if (pct >= warningPct) alertLevel = "warning";

    const client = clientMap.get(snap.organizationId);
    const clientEmail = client?.email
      || client?.contacts?.find(c => c.email)?.email
      || client?.portalUsers?.[0]?.email
      || null;

    results.push({
      organizationId: snap.organizationId,
      clientId: client?.id || null,
      clientName: client?.name || null,
      clientEmail,
      portalUserEmails: client?.portalUsers.map(u => u.email) || [],
      allocatedQuota: snap.allocatedQuota,
      currentUsage: snap.currentUsage,
      usagePercent: Math.round(pct * 10) / 10,
      alertLevel,
    });
  }

  return results.sort((a, b) => b.usagePercent - a.usagePercent);
}

export function formatBytes(bytes: bigint | number): string {
  const b = Number(bytes);
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} Ko`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} Mo`;
  if (b < 1099511627776) return `${(b / 1073741824).toFixed(1)} Go`;
  return `${(b / 1099511627776).toFixed(1)} To`;
}

function replacePlaceholders(template: string, org: OrgQuotaInfo): string {
  return template
    .replace(/\{clientName\}/g, org.clientName || org.organizationId)
    .replace(/\{usagePercent\}/g, String(org.usagePercent))
    .replace(/\{currentUsage\}/g, formatBytes(org.currentUsage!))
    .replace(/\{allocatedQuota\}/g, formatBytes(org.allocatedQuota!))
    .replace(/\{organizationId\}/g, org.organizationId);
}

function buildClientEmailHtml(org: OrgQuotaInfo, config: QuotaAlertConfig): string {
  const isExceeded = org.alertLevel === "exceeded";
  const bodyTemplate = isExceeded ? config.bodyExceeded : config.bodyWarning;
  const bodyText = replacePlaceholders(bodyTemplate, org);
  const bodyHtml = bodyText.split("\n").map(line => line.trim() === "" ? "<br>" : `<p style="margin:0 0 10px;color:#334155;font-size:14px;line-height:1.6">${line}</p>`).join("");

  const barColor = isExceeded ? "#dc2626" : "#f59e0b";
  const barBg = isExceeded ? "#fef2f2" : "#fffbeb";
  const barWidth = Math.min(org.usagePercent, 100);
  const iconColor = isExceeded ? "#dc2626" : "#d97706";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
      <!-- Header -->
      <div style="background:${isExceeded ? "#dc2626" : "#f59e0b"};padding:24px 32px;text-align:center">
        <h1 style="color:#ffffff;font-size:20px;margin:0;font-weight:600">${config.companyName}</h1>
      </div>

      <!-- Body -->
      <div style="padding:32px">
        ${bodyHtml}

        <!-- Usage bar -->
        <div style="margin:24px 0;padding:20px;background:${barBg};border-radius:8px;border:1px solid ${barColor}20">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:13px;color:#64748b">Espace utilisé</span>
            <span style="font-size:13px;font-weight:700;color:${iconColor}">${org.usagePercent}%</span>
          </div>
          <div style="height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden">
            <div style="width:${barWidth}%;height:100%;background:${barColor};border-radius:6px"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px">
            <span style="font-size:12px;color:#94a3b8">${formatBytes(org.currentUsage!)} utilisés</span>
            <span style="font-size:12px;color:#94a3b8">${formatBytes(org.allocatedQuota!)} total</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5">${config.emailFooter}</p>
      </div>
    </div>
  `;
}

export async function getClientsWithAlertStatus(config: QuotaAlertConfig) {
  const orgs = await getOrgsExceedingThresholds(
    config.warningThreshold,
    config.exceededThreshold,
  );
  const alertable = orgs.filter(o => o.alertLevel !== null);

  const lastAlerts = await prisma.quotaAlert.findMany({
    where: {
      organizationId: { in: alertable.map(o => o.organizationId) },
    },
    orderBy: { sentAt: "desc" },
    distinct: ["organizationId"],
  });
  const lastAlertMap = new Map(lastAlerts.map(a => [a.organizationId, a]));

  return alertable.map(o => {
    const last = lastAlertMap.get(o.organizationId);
    return {
      organizationId: o.organizationId,
      clientName: o.clientName,
      clientEmail: o.clientEmail,
      usagePercent: o.usagePercent,
      allocatedQuota: o.allocatedQuota ? formatBytes(o.allocatedQuota) : null,
      currentUsage: o.currentUsage ? formatBytes(o.currentUsage) : null,
      alertLevel: o.alertLevel!,
      lastAlert: last ? {
        alertType: last.alertType,
        sentAt: last.sentAt.toISOString(),
        manual: last.manual,
      } : null,
    };
  });
}

async function sendToOrgs(
  orgsToAlert: OrgQuotaInfo[],
  config: QuotaAlertConfig,
  manual: boolean,
): Promise<{ organizationId: string; clientName: string | null; alertLevel: string; usagePercent: number; sentTo: string[]; error?: string }[]> {
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) throw new Error("SMTP non configuré");

  const useSecure = smtpConfig.port === 465;
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: useSecure,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    tls: { rejectUnauthorized: false },
  });

  const results: { organizationId: string; clientName: string | null; alertLevel: string; usagePercent: number; sentTo: string[]; error?: string }[] = [];

  for (const org of orgsToAlert) {
    const recipients: string[] = [org.clientEmail!];
    if (config.sendToPortalUsers && org.portalUserEmails.length > 0) {
      for (const email of org.portalUserEmails) {
        if (!recipients.includes(email)) recipients.push(email);
      }
    }

    const subject = replacePlaceholders(
      org.alertLevel === "exceeded" ? config.subjectExceeded : config.subjectWarning,
      org,
    );
    const html = buildClientEmailHtml(org, config);

    const mailOptions: nodemailer.SendMailOptions = {
      from: smtpConfig.from,
      to: recipients.join(", "),
      subject,
      html,
    };

    if (config.ccAdmins && config.adminEmails.length > 0) {
      mailOptions.cc = config.adminEmails.join(", ");
    }

    try {
      await transporter.sendMail(mailOptions);
      await prisma.quotaAlert.create({
        data: {
          organizationId: org.organizationId,
          clientName: org.clientName,
          alertType: org.alertLevel!,
          usagePercent: org.usagePercent,
          allocatedQuota: org.allocatedQuota,
          currentUsage: org.currentUsage,
          recipients: JSON.stringify(recipients),
          manual,
        },
      }).catch(() => {});
      results.push({ organizationId: org.organizationId, clientName: org.clientName, alertLevel: org.alertLevel!, usagePercent: org.usagePercent, sentTo: recipients });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      console.error(`[quota-alerts] Failed to send to ${org.clientEmail}:`, err);
      results.push({ organizationId: org.organizationId, clientName: org.clientName, alertLevel: org.alertLevel!, usagePercent: org.usagePercent, sentTo: recipients, error: msg });
    }
  }

  return results;
}

export async function sendQuotaAlertsToSelected(organizationIds: string[]): Promise<{
  sent: boolean;
  count: number;
  results: { organizationId: string; clientName: string | null; alertLevel: string; sentTo: string[]; error?: string }[];
}> {
  const config = await getQuotaAlertConfig();
  const orgs = await getOrgsExceedingThresholds(config.warningThreshold, config.exceededThreshold);
  const selected = orgs.filter(o => organizationIds.includes(o.organizationId) && o.alertLevel !== null && o.clientEmail);

  if (selected.length === 0) {
    return { sent: false, count: 0, results: [] };
  }

  const results = await sendToOrgs(selected, config, true);
  const successes = results.filter(r => !r.error);
  return { sent: successes.length > 0, count: successes.length, results };
}

export async function checkAndSendQuotaAlerts(): Promise<{
  sent: boolean;
  count: number;
  reason?: string;
}> {
  const config = await getQuotaAlertConfig();
  if (!config.enabled || !config.autoSend) {
    return { sent: false, count: 0, reason: "Alertes auto désactivées" };
  }

  const orgs = await getOrgsExceedingThresholds(config.warningThreshold, config.exceededThreshold);
  const alertable = orgs.filter(o => o.alertLevel !== null && o.clientEmail);

  if (alertable.length === 0) {
    return { sent: false, count: 0, reason: "Aucun client ne dépasse les seuils" };
  }

  // Filter based on repeat mode
  let toSend = alertable;
  if (config.repeatMode === "once") {
    const alreadySent = await prisma.quotaAlert.findMany({
      where: { organizationId: { in: alertable.map(o => o.organizationId) } },
      select: { organizationId: true, alertType: true },
      distinct: ["organizationId", "alertType"],
    });
    const sentSet = new Set(alreadySent.map(a => `${a.organizationId}:${a.alertType}`));
    toSend = alertable.filter(o => !sentSet.has(`${o.organizationId}:${o.alertLevel}`));
  } else {
    const cutoff = new Date(Date.now() - config.repeatDays * 86400000);
    const recentAlerts = await prisma.quotaAlert.findMany({
      where: { sentAt: { gte: cutoff } },
      select: { organizationId: true, alertType: true },
    });
    const recentSet = new Set(recentAlerts.map(a => `${a.organizationId}:${a.alertType}`));
    toSend = alertable.filter(o => !recentSet.has(`${o.organizationId}:${o.alertLevel}`));
  }

  if (toSend.length === 0) {
    return { sent: false, count: 0, reason: config.repeatMode === "once" ? "Tous les clients ont déjà été alertés" : "Prochain rappel pas encore dû" };
  }

  const results = await sendToOrgs(toSend, config, false);
  const successes = results.filter(r => !r.error);
  return { sent: successes.length > 0, count: successes.length };
}

export async function getQuotaAlertHistory(limit = 50, offset = 0) {
  const [alerts, total] = await Promise.all([
    prisma.quotaAlert.findMany({
      orderBy: { sentAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.quotaAlert.count(),
  ]);

  return {
    alerts: alerts.map(a => ({
      id: a.id,
      organizationId: a.organizationId,
      clientName: a.clientName,
      alertType: a.alertType,
      usagePercent: a.usagePercent,
      allocatedQuota: a.allocatedQuota ? formatBytes(a.allocatedQuota) : null,
      currentUsage: a.currentUsage ? formatBytes(a.currentUsage) : null,
      recipients: JSON.parse(a.recipients) as string[],
      sentAt: a.sentAt.toISOString(),
      manual: a.manual,
    })),
    total,
  };
}

export async function sendTestQuotaAlert(testEmail: string, alertType: AlertLevel): Promise<{ html: string }> {
  const config = await getQuotaAlertConfig();
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig) throw new Error("SMTP non configuré");

  const fakeOrg: OrgQuotaInfo = {
    organizationId: "TEST-ORG",
    clientId: null,
    clientName: "Client Exemple",
    clientEmail: testEmail,
    portalUserEmails: [],
    allocatedQuota: BigInt(1099511627776),
    currentUsage: alertType === "exceeded" ? BigInt(1121501860864) : BigInt(879609302221),
    usagePercent: alertType === "exceeded" ? 102 : 80,
    alertLevel: alertType,
  };

  const html = buildClientEmailHtml(fakeOrg, config);
  const subject = replacePlaceholders(
    alertType === "exceeded" ? config.subjectExceeded : config.subjectWarning,
    fakeOrg,
  );

  const useSecure = smtpConfig.port === 465;
  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: useSecure,
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
    tls: { rejectUnauthorized: false },
  });

  await transporter.sendMail({
    from: smtpConfig.from,
    to: testEmail,
    subject: `[TEST] ${subject}`,
    html,
  });

  return { html };
}

export async function previewQuotaAlertHtml(alertType: AlertLevel): Promise<string> {
  const config = await getQuotaAlertConfig();
  const fakeOrg: OrgQuotaInfo = {
    organizationId: "EXEMPLE",
    clientId: null,
    clientName: "Client Exemple",
    clientEmail: "client@exemple.fr",
    portalUserEmails: [],
    allocatedQuota: BigInt(1099511627776),
    currentUsage: alertType === "exceeded" ? BigInt(1121501860864) : BigInt(879609302221),
    usagePercent: alertType === "exceeded" ? 102 : 80,
    alertLevel: alertType,
  };
  return buildClientEmailHtml(fakeOrg, config);
}
