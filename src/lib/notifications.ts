import { prisma } from "@/lib/db";
import { sendEmail, getSmtpConfig } from "@/lib/email";

export type NotificationType =
  | "card_assigned"
  | "card_comment"
  | "card_moved"
  | "card_archived"
  | "card_due"
  | "ticket_new"
  | "ticket_reply"
  | "backup_error"
  | "mention";

// Maps notification type to the preference field name
const TYPE_TO_PREF: Record<NotificationType, string> = {
  card_assigned: "cardAssigned",
  card_comment: "cardComment",
  card_moved: "cardMoved",
  card_archived: "cardArchived",
  card_due: "cardDueDate",
  ticket_new: "ticketNew",
  ticket_reply: "ticketReply",
  backup_error: "backupError",
  mention: "cardComment",
};

const TYPE_TO_EMAIL_PREF: Partial<Record<NotificationType, string>> = {
  card_assigned: "emailCardAssigned",
  card_comment: "emailCardComment",
  ticket_new: "emailTicketNew",
  ticket_reply: "emailTicketReply",
};

export async function getUserPreferences(userId: string) {
  let prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  if (!prefs) {
    prefs = await prisma.notificationPreference.create({
      data: { userId },
    });
  }

  return prefs;
}

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  email?: {
    to: string[];
    subject: string;
    html: string;
  };
}

/**
 * Creates a notification respecting user preferences.
 * Returns true if notification was created, false if suppressed.
 */
export async function createNotification(params: CreateNotificationParams): Promise<boolean> {
  const { userId, type, title, message, link, email } = params;

  const prefs = await getUserPreferences(userId);

  // Check global mute
  if (prefs.muteAll) return false;

  // Check in-app preference
  const prefField = TYPE_TO_PREF[type];
  const inAppEnabled = prefField ? (prefs as Record<string, unknown>)[prefField] !== false : true;

  if (inAppEnabled) {
    await prisma.notification.create({
      data: { userId, title, message, link, type },
    });
  }

  // Check email preference
  if (email && prefs.emailEnabled) {
    const emailPrefField = TYPE_TO_EMAIL_PREF[type];
    const emailEnabled = emailPrefField ? (prefs as Record<string, unknown>)[emailPrefField] !== false : false;

    if (emailEnabled) {
      const smtpConfig = await getSmtpConfig();
      if (smtpConfig) {
        sendEmail(email.to, email.subject, email.html).catch((err) =>
          console.error("Email notification error:", err)
        );
      }
    }
  }

  return inAppEnabled;
}

/**
 * Creates notifications for multiple users with the same content.
 * Skips the excludeUserId (typically the actor).
 */
export async function notifyUsers(params: {
  userIds: string[];
  excludeUserId?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const { userIds, excludeUserId, type, title, message, link } = params;

  for (const uid of userIds) {
    if (uid === excludeUserId) continue;
    await createNotification({ userId: uid, type, title, message, link });
  }
}

/**
 * Notify all admin users (for ticket events from portal).
 */
export async function notifyAdmins(params: {
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  const admins = await prisma.user.findMany({
    select: { id: true },
  });

  for (const admin of admins) {
    await createNotification({
      userId: admin.id,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
    });
  }
}
