import { prisma } from "@/lib/db";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGIN_FAILED"
  | "SETTINGS_CHANGE"
  | "ROLE_CHANGE"
  | "PASSWORD_CHANGE";

interface AuditParams {
  userId?: string | null;
  userName?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  details?: string | null;
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId || null,
        userName: params.userName || "Système",
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        details: params.details || null,
      },
    });
  } catch {
    console.error("[audit] Failed to log:", params.action, params.entity);
  }
}
