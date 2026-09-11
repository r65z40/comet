import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// GET: Validate token
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, retryAfterMs } = checkRateLimit(`portal-reset-password:${ip}`, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ valid: false, error: "Token manquant" }, { status: 400 });
  }

  // Hash the incoming token to match against stored hash
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const reset = await prisma.clientPasswordReset.findUnique({
    where: { token: tokenHash },
    include: { clientUser: { select: { name: true, email: true } } },
  });

  if (!reset || reset.used || reset.expiresAt < new Date()) {
    return NextResponse.json({
      valid: false,
      error: "Ce lien est invalide ou a expiré.",
    });
  }

  return NextResponse.json({
    valid: true,
    userName: reset.clientUser.name,
  });
}

// POST: Reset password
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, retryAfterMs } = checkRateLimit(`portal-reset-password:${ip}`, 5, 60_000);
  if (!allowed) return rateLimitResponse(retryAfterMs);

  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token et mot de passe requis" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 });
    }

    // Hash the incoming token to match against stored hash
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const reset = await prisma.clientPasswordReset.findUnique({
      where: { token: tokenHash },
    });

    if (!reset || reset.used || reset.expiresAt < new Date()) {
      return NextResponse.json({
        error: "Ce lien est invalide ou a expiré. Veuillez refaire une demande.",
      }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.clientUser.update({
        where: { id: reset.clientUserId },
        data: { password: hashedPassword },
      }),
      prisma.clientPasswordReset.update({
        where: { id: reset.id },
        data: { used: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Mot de passe réinitialisé avec succès.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
