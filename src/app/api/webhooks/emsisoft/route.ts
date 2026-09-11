import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { notifyAdmins } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  const settings = await getSettings(["webhook_secret"]);
  const expectedSecret = settings.webhook_secret;
  if (!expectedSecret) {
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });
  }
  const providedSecret = req.headers.get("x-webhook-secret") || "";
  const providedBuf = Buffer.from(providedSecret);
  const expectedBuf = Buffer.from(expectedSecret);
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      type: "security_alert",
      title: `Alerte Emsisoft : ${title}`,
      message: `${description}${detail ? ` (${detail})` : ""}`,
      link: "/antivirus",
    });
  }

  return NextResponse.json({ received: true });
}
