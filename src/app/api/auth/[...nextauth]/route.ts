import { NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const GET = handlers.GET;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(`admin-login:${ip}`, 5, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  return handlers.POST(req);
}
