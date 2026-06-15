import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

interface QuotaAlertConfig {
  enabled: boolean;
  warningThreshold: number;    // e.g. 80
  criticalThreshold: number;   // e.g. 95
  exceededThreshold: number;   // 100
  autoSend: boolean;
  cooldownHours: number;       // don't re-alert same org within this window
  recipients: string[];        // override emails (empty = use notification_emails)
  emailSubjectPrefix: string;
  includeClientName: boolean;
}

export async function getQuotaAlertConfig(): Promise<QuotaAlertConfig> {
  const keys = [
    "quota_alert_enabled",
    "quota_alert_warning",
    "quota_alert_critical",
    "quota_alert_exceeded",
    "quota_alert_auto_send",
    "quota_alert_cooldown_hours",
    "quota_alert_recipients",
    "quota_alert_subject_prefix",
    "quota_alert_include_client_name",
    "notification_emails",
  ];
  const settings = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const m: Record<string, string> = {};
  for (const s of settings) m[s.key] = s.value;

  const specificRecipients = (m.quota_alert_recipients || "")
    .split(",").map(e => e.trim()).filter(Boolean);
  const fallbackRecipients = (m.notification_emails || "")
    .split(",").map(e => e.trim()).filter(Boolean);

  return {
    enabled: m.quota_alert_enabled === "true",
    warningThreshold: parseInt(m.quota_alert_warning || "80"),
    criticalThreshold: parseInt(m.quota_alert_critical || "95"),
    exceededThreshold: parseInt(m.quota_alert_exceeded || "100"),
    autoSend: m.quota_alert_auto_send !== "false",
    cooldownHours: parseInt(m.quota_alert_cooldown_hours || "24"),
    recipients: specificRecipients.length > 0 ? specificRecipients : fallbackRecipients,
    emailSubjectPrefix: m.quota_alert_subject_prefix || "[COMET]",
    includeClientName: m.quota_alert_include_client_name !== "false",
  };
}

export type AlertLevel = "warning" | "critical" | "exceeded";

interface OrgQuotaInfo {
  organizationId: string;
  clientName: string | null;
  allocatedQuota: bigint | null;
  currentUsage: bigint | null;
  usagePercent: number;
  alertLevel: AlertLevel | null;
}

export async function getOrgsExceedingThresholds(
  warningPct: number,
  criticalPct: number,
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
    select: { oxiboxId: true, name: true },
  });
  const clientMap = new Map(clients.map(c => [c.oxiboxId!, c.name]));

  const results: OrgQuotaInfo[] = [];

  for (const snap of snapshots) {
    if (!snap.allocatedQuota || !snap.currentUsage) continue;
    const allocated = Number(snap.allocatedQuota);
    if (allocated === 0) continue;

    const usage = Number(snap.currentUsage);
    const pct = (usage / allocated) * 100;

    let alertLevel: AlertLevel | null = null;
    if (pct >= exceededPct) alertLevel = "exceeded";
    else if (pct >= criticalPct) alertLevel = "critical";
    else if (pct >= warningPct) alertLevel = "warning";

    if (alertLevel) {
      results.push({
        organizationId: snap.organizationId,
        clientName: clientMap.get(snap.organizationId) || null,
        allocatedQuota: snap.allocatedQuota,
        currentUsage: snap.currentUsage,
        usagePercent: Math.round(pct * 10) / 10,
        alertLevel,
      });
    }
  }

  return results.sort((a, b) => b.usagePercent - a.usagePercent);
}

function formatBytes(bytes: bigint | number): string {
  const b = Number(bytes);
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} Ko`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} Mo`;
  return `${(b / 1073741824).toFixed(1)} Go`;
}

function alertLevelLabel(level: AlertLevel): string {
  switch (level) {
    case "warning": return "Avertissement";
    case "critical": return "Critique";
    case "exceeded": return "Dépassé";
  }
}

function alertLevelColor(level: AlertLevel): string {
  switch (level) {
    case "warning": return "#f59e0b";
    case "critical": return "#f97316";
    case "exceeded": return "#dc2626";
  }
}

function alertLevelEmoji(level: AlertLevel): string {
  switch (level) {
    case "warning": return "⚠️";
    case "critical": return "🔶";
    case "exceeded": return "🔴";
  }
}

function buildQuotaAlertHtml(orgs: OrgQuotaInfo[], config: QuotaAlertConfig): string {
  const exceeded = orgs.filter(o => o.alertLevel === "exceeded");
  const critical = orgs.filter(o => o.alertLevel === "critical");
  const warning = orgs.filter(o => o.alertLevel === "warning");

  const renderRow = (org: OrgQuotaInfo) => {
    const color = alertLevelColor(org.alertLevel!);
    const name = config.includeClientName && org.clientName
      ? org.clientName
      : org.organizationId;
    const barWidth = Math.min(org.usagePercent, 100);
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">${name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">${formatBytes(org.currentUsage!)} / ${formatBytes(org.allocatedQuota!)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
            <div style="width:${barWidth}%;height:100%;background:${color};border-radius:4px"></div>
          </div>
          <span style="color:${color};font-weight:600;white-space:nowrap">${org.usagePercent}%</span>
        </div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">
        <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${color}20;color:${color}">${alertLevelLabel(org.alertLevel!)}</span>
      </td>
    </tr>`;
  };

  const sections: string[] = [];

  if (exceeded.length > 0) {
    sections.push(`
      <h3 style="color:#dc2626;margin:20px 0 8px">🔴 Quota dépassé (${exceeded.length})</h3>
      <table style="width:100%;border-collapse:collapse">${exceeded.map(renderRow).join("")}</table>
    `);
  }
  if (critical.length > 0) {
    sections.push(`
      <h3 style="color:#f97316;margin:20px 0 8px">🔶 Niveau critique (${critical.length})</h3>
      <table style="width:100%;border-collapse:collapse">${critical.map(renderRow).join("")}</table>
    `);
  }
  if (warning.length > 0) {
    sections.push(`
      <h3 style="color:#f59e0b;margin:20px 0 8px">⚠️ Avertissement (${warning.length})</h3>
      <table style="width:100%;border-collapse:collapse">${warning.map(renderRow).join("")}</table>
    `);
  }

  return `
    <div style="font-family:Arial,sans-serif;max-width:750px;margin:0 auto">
      <h2 style="color:#1e293b;margin-bottom:4px">Alerte Quota de Sauvegarde</h2>
      <p style="color:#64748b;margin-top:4px">${orgs.length} organisation(s) avec un quota préoccupant</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:13px">Organisation</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:13px">Utilisation</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:13px;min-width:180px">Progression</th>
            <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #cbd5e1;font-size:13px">Niveau</th>
          </tr>
        </thead>
        <tbody>
          ${orgs.map(renderRow).join("")}
        </tbody>
      </table>
      ${sections.length > 0 ? "" : ""}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">
        Email envoyé ${new Date().toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })} par COMET CEDELIA
      </p>
    </div>
  `;
}

export async function checkAndSendQuotaAlerts(manual = false): Promise<{
  sent: boolean;
  count: number;
  reason?: string;
  details?: { organizationId: string; clientName: string | null; alertLevel: string; usagePercent: number }[];
}> {
  const config = await getQuotaAlertConfig();

  if (!manual && !config.enabled) {
    return { sent: false, count: 0, reason: "Alertes quota désactivées" };
  }

  if (config.recipients.length === 0) {
    return { sent: false, count: 0, reason: "Aucun destinataire configuré" };
  }

  const orgs = await getOrgsExceedingThresholds(
    config.warningThreshold,
    config.criticalThreshold,
    config.exceededThreshold,
  );

  if (orgs.length === 0) {
    return { sent: false, count: 0, reason: "Aucune organisation ne dépasse les seuils configurés" };
  }

  // Filter out orgs that were already alerted within cooldown (unless manual)
  let orgsToAlert = orgs;
  if (!manual) {
    const cooldownCutoff = new Date(Date.now() - config.cooldownHours * 3600000);
    const recentAlerts = await prisma.quotaAlert.findMany({
      where: { sentAt: { gte: cooldownCutoff } },
      select: { organizationId: true, alertType: true },
    });
    const recentSet = new Set(recentAlerts.map(a => `${a.organizationId}:${a.alertType}`));
    orgsToAlert = orgs.filter(o => !recentSet.has(`${o.organizationId}:${o.alertLevel}`));
  }

  if (orgsToAlert.length === 0) {
    return { sent: false, count: 0, reason: "Alertes déjà envoyées récemment (cooldown)" };
  }

  // Build and send email
  const html = buildQuotaAlertHtml(orgsToAlert, config);
  const levelCounts = {
    exceeded: orgsToAlert.filter(o => o.alertLevel === "exceeded").length,
    critical: orgsToAlert.filter(o => o.alertLevel === "critical").length,
    warning: orgsToAlert.filter(o => o.alertLevel === "warning").length,
  };

  const subjectParts: string[] = [];
  if (levelCounts.exceeded > 0) subjectParts.push(`${levelCounts.exceeded} dépassé(s)`);
  if (levelCounts.critical > 0) subjectParts.push(`${levelCounts.critical} critique(s)`);
  if (levelCounts.warning > 0) subjectParts.push(`${levelCounts.warning} avertissement(s)`);

  const subject = `${config.emailSubjectPrefix} Quota sauvegarde — ${subjectParts.join(", ")}`;

  await sendEmail(config.recipients, subject, html);

  // Record in history
  const alertRecords = orgsToAlert.map(org => ({
    organizationId: org.organizationId,
    clientName: org.clientName,
    alertType: org.alertLevel!,
    usagePercent: org.usagePercent,
    allocatedQuota: org.allocatedQuota,
    currentUsage: org.currentUsage,
    recipients: JSON.stringify(config.recipients),
    manual,
  }));

  await prisma.quotaAlert.createMany({ data: alertRecords }).catch(() => {});

  return {
    sent: true,
    count: orgsToAlert.length,
    details: orgsToAlert.map(o => ({
      organizationId: o.organizationId,
      clientName: o.clientName,
      alertLevel: o.alertLevel!,
      usagePercent: o.usagePercent,
    })),
  };
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

export async function getQuotaOverview() {
  const orgs = await getOrgsExceedingThresholds(0, 0, 999);

  return orgs.map(o => ({
    organizationId: o.organizationId,
    clientName: o.clientName,
    allocatedQuota: o.allocatedQuota ? formatBytes(o.allocatedQuota) : null,
    currentUsage: o.currentUsage ? formatBytes(o.currentUsage) : null,
    usagePercent: o.usagePercent,
    alertLevel: o.alertLevel,
  }));
}
