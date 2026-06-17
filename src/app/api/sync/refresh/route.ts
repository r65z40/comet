import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { refreshClient, refreshProduct, refreshInvoice } from "@/lib/axonaut";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();
  const { type, axonautId } = body;

  if (!type || !axonautId) {
    return NextResponse.json({ error: "type et axonautId requis" }, { status: 400 });
  }

  try {
    let result;
    switch (type) {
      case "client":
        result = await refreshClient(axonautId);
        break;
      case "product":
        result = await refreshProduct(axonautId);
        break;
      case "invoice":
        result = await refreshInvoice(axonautId);
        break;
      default:
        return NextResponse.json({ error: "Type invalide" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de synchronisation" },
      { status: 500 }
    );
  }
}
