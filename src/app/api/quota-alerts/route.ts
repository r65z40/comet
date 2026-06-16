import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getQuotaAlertConfig,
  getClientsWithAlertStatus,
  sendQuotaAlertsToSelected,
  getQuotaAlertHistory,
} from "@/lib/quota-alerts";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");

  if (action === "clients") {
    const config = await getQuotaAlertConfig();
    const clients = await getClientsWithAlertStatus(config);
    return NextResponse.json({ clients });
  }

  if (action === "history") {
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");
    const data = await getQuotaAlertHistory(limit, offset);
    return NextResponse.json(data);
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

  if (action === "send-selected") {
    const { organizationIds } = body;
    if (!Array.isArray(organizationIds) || organizationIds.length === 0) {
      return NextResponse.json({ error: "Aucun client sélectionné" }, { status: 400 });
    }
    try {
      const result = await sendQuotaAlertsToSelected(organizationIds);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur d'envoi" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}
