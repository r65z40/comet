import { prisma } from "@/lib/db";

interface LogParams {
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
}

export async function logActivity(params: LogParams) {
  try {
    await prisma.activityLog.create({ data: params });
  } catch {
    // Activity logging should never break the main flow
    console.error("[activity] Failed to log:", params);
  }
}
