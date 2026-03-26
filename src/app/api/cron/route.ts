import { NextRequest, NextResponse } from "next/server";
import { executeCronJob } from "@/lib/cron-scheduler";

/**
 * GET /api/cron
 *
 * External endpoint for triggering cron jobs (Docker entrypoint, Vercel cron, etc.).
 * Also runs automatically via the built-in scheduler (src/instrumentation.ts).
 *
 * Requires CRON_SECRET env var and x-cron-secret header for authentication.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET not configured — endpoint disabled for security");
    return NextResponse.json({ error: "Endpoint non configuré" }, { status: 503 });
  }
  const secret = req.headers.get("x-cron-secret");
  if (secret !== cronSecret) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const result = await executeCronJob();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
