import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { testSmtpConnection, sendExpiryNotifications } from "@/lib/email";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json();

  if (body.action === "test") {
    // Use provided SMTP config from form if available
    const config = body.smtp
      ? {
          host: body.smtp.host,
          port: parseInt(body.smtp.port || "587"),
          secure: body.smtp.secure === true || body.smtp.secure === "true",
          user: body.smtp.user,
          pass: body.smtp.pass,
          from: body.smtp.from || body.smtp.user,
        }
      : undefined;

    const result = await testSmtpConnection(config);
    return NextResponse.json(result);
  }

  if (body.action === "send") {
    try {
      const result = await sendExpiryNotifications();
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur d'envoi" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}
