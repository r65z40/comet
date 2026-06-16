import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getQuotaAlertConfig,
  checkAndSendQuotaAlerts,
  getQuotaAlertHistory,
  getOrgsExceedingThresholds,
} from "@/lib/quota-alerts";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");

  if (action === "history") {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");
    const data = await getQuotaAlertHistory(limit, offset);
    return NextResponse.json(data);
  }

  if (action === "config") {
    const config = await getQuotaAlertConfig();
    return NextResponse.json(config);
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "send") {
    try {
      const result = await checkAndSendQuotaAlerts(true);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur d'envoi" },
        { status: 500 },
      );
    }
  }

  if (action === "preview") {
    try {
      const config = await getQuotaAlertConfig();
      const orgs = await getOrgsExceedingThresholds(
        config.warningThreshold,
        config.exceededThreshold,
      );
      const alertable = orgs.filter(o => o.alertLevel !== null);
      return NextResponse.json({
        count: alertable.length,
        organizations: alertable.map(o => ({
          organizationId: o.organizationId,
          clientName: o.clientName,
          clientEmail: o.clientEmail,
          usagePercent: o.usagePercent,
          alertLevel: o.alertLevel,
        })),
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}
