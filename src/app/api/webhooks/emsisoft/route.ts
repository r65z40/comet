import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { notifyAdmins } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const eventType = body.type || body.eventType || "";
  const severity = body.severity || "info";
  const title = body.title || body.alertTitle || "Événement Emsisoft";
  const deviceName = body.deviceName || body.device || "";
  const description = body.description || body.message || "";
  const workspaceName = body.workspaceName || body.workspace || "";

  await prisma.activityLog.create({
    data: {
      action: "EMSISOFT_WEBHOOK",
      entity: "emsisoft",
      entityId: body.id || null,
      details: JSON.stringify({
        type: eventType,
        severity,
        title,
        deviceName,
        description,
        workspaceName,
      }),
      userName: "Emsisoft",
    },
  });

  const isCritical = severity === "critical" || severity === "high" ||
    eventType.includes("malware") || eventType.includes("threat") ||
    eventType.includes("protection_disabled");

  if (isCritical) {
    const detail = [deviceName, workspaceName].filter(Boolean).join(" — ");
    await notifyAdmins({
      type: "backup_error",
      title: `⚠ Alerte Emsisoft : ${title}`,
      message: `${description}${detail ? ` (${detail})` : ""}`,
      link: "/board",
    });
  }

  return NextResponse.json({ received: true });
}
