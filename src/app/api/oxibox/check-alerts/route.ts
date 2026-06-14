import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sendEmail, getNotificationConfig } from "@/lib/email";
import { notifyAdmins } from "@/lib/notifications";
import { getOxiboxToken, getAllOxiboxAccounts } from "@/lib/oxibox";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const token = await getOxiboxToken();
  if (!token) return NextResponse.json({ error: "Clé API Oxibox non configurée" }, { status: 400 });

  const alertEnabledSetting = await prisma.setting.findUnique({ where: { key: "alert_enabled" } });
  if (alertEnabledSetting?.value !== "true") {
    return NextResponse.json({ skipped: true, reason: "Alertes désactivées" });
  }

  try {
    const allItems = await getAllOxiboxAccounts(token);

    const allAccounts = allItems.map((item) => ({
      organizationId: item.organizationId || item.id,
      status: item.status || "UNKNOWN",
      machineCount: item.machineCount ?? item.machines?.length ?? 0,
    }));

    const errorAccounts = allAccounts.filter((a) => a.status === "ERROR");

    if (errorAccounts.length === 0) {
      return NextResponse.json({ sent: false, reason: "Aucun compte en erreur" });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const recentAlert = await prisma.syncLog.findFirst({
      where: {
        type: "OXIBOX_ALERT",
        status: "success",
        startedAt: { gte: todayStart },
      },
    });

    if (recentAlert) {
      return NextResponse.json({ skipped: true, reason: "Alerte déjà envoyée aujourd'hui" });
    }

    const { emails } = await getNotificationConfig();

    if (emails.length > 0) {
      const rows = errorAccounts
        .map(
          (a) =>
            `<tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#ef4444;font-weight:bold">${a.organizationId}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0">${a.machineCount} machine(s)</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#ef4444">ERROR</td>
            </tr>`,
        )
        .join("");

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
          <h2 style="color:#ef4444">⚠ Alerte Sauvegarde Oxibox</h2>
          <p style="color:#64748b">${errorAccounts.length} compte(s) Oxibox en erreur détecté(s).</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px">
            <thead>
              <tr style="background:#fef2f2">
                <th style="padding:8px;text-align:left;border-bottom:2px solid #fecaca">Organisation</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #fecaca">Machines</th>
                <th style="padding:8px;text-align:left;border-bottom:2px solid #fecaca">Statut</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#94a3b8;font-size:12px;margin-top:24px">
            Email envoyé automatiquement par COMET CEDELIA
          </p>
        </div>
      `;

      try {
        await sendEmail(
          emails,
          `[COMET] ${errorAccounts.length} sauvegarde(s) Oxibox en erreur`,
          html,
        );
      } catch (emailErr) {
        console.error("Failed to send Oxibox alert email:", emailErr);
      }
    }

    const errorList = errorAccounts
      .map((a) => `${a.organizationId} (${a.machineCount} machines)`)
      .join(", ");

    await notifyAdmins({
      type: "backup_error",
      title: "Alerte Sauvegarde Oxibox",
      message: `${errorAccounts.length} compte(s) en erreur : ${errorList}`,
      link: "/backups",
    });

    await prisma.syncLog.create({
      data: {
        type: "OXIBOX_ALERT",
        status: "success",
        message: `${errorAccounts.length} compte(s) en erreur : ${errorList}`,
        itemCount: errorAccounts.length,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ sent: true, errorCount: errorAccounts.length });
  } catch (err) {
    await prisma.syncLog.create({
      data: {
        type: "OXIBOX_ALERT",
        status: "error",
        message: `Erreur lors de la vérification : ${String(err)}`,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }).catch(() => {});

    return NextResponse.json(
      { error: "Erreur lors de la vérification des alertes", details: String(err) },
      { status: 500 },
    );
  }
}
