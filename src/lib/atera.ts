import { prisma } from "@/lib/db";

const ATERA_BASE_URL = "https://app.atera.com/api/v3";

interface AteraConfig {
  apiKey: string;
  enabled: boolean;
}

export async function getAteraConfig(): Promise<AteraConfig | null> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["atera_api_key", "atera_enabled"] } },
  });

  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  if (!map.atera_api_key) return null;

  return {
    apiKey: map.atera_api_key,
    enabled: map.atera_enabled === "true",
  };
}

async function ateraFetch(path: string, options: RequestInit = {}) {
  const config = await getAteraConfig();
  if (!config || !config.enabled) {
    throw new Error("Atera n'est pas configuré ou désactivé");
  }

  const res = await fetch(`${ATERA_BASE_URL}${path}`, {
    ...options,
    headers: {
      "X-API-KEY": config.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Atera API ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json();
  }
  return null;
}

// ─── Ticket Operations ──────────────────────────────────

export interface AteraTicketCreate {
  TicketTitle: string;
  Description: string;
  EndUserEmail?: string;
  EndUserFirstName?: string;
  EndUserLastName?: string;
  CustomerName?: string;
  TicketPriority?: string;
  TicketType?: string;
  TicketImpact?: string;
}

export interface AteraTicketResponse {
  TicketID: number;
  TicketTitle: string;
  TicketNumber: string;
  TicketPriority: string;
  TicketImpact: string;
  TicketStatus: string;
  TicketType: string;
  EndUserID: number;
  EndUserEmail: string;
  EndUserFirstName: string;
  EndUserLastName: string;
  CustomerID: number;
  CustomerName: string;
  TechnicianContactID: number;
  TechnicianFullName: string;
  TicketResolvedDate: string | null;
  TicketCreatedDate: string;
  FirstComment: string;
  LastEndUserComment: string;
  LastEndUserCommentTimestamp: string | null;
  LastTechnicianComment: string;
  LastTechnicianCommentTimestamp: string | null;
}

export interface AteraComment {
  Date: string;
  Comment: string;
  EndUserID: number;
  TechnicianContactID: number;
  Email: string;
  FirstName: string;
  LastName: string;
  IsInternal: boolean;
}

export async function createAteraTicket(data: AteraTicketCreate): Promise<AteraTicketResponse> {
  return ateraFetch("/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAteraTicket(ticketId: number): Promise<AteraTicketResponse> {
  return ateraFetch(`/tickets/${ticketId}`);
}

export async function updateAteraTicket(ticketId: number, data: Partial<{
  TicketTitle: string;
  TicketStatus: string;
  TicketPriority: string;
  TicketType: string;
  TicketImpact: string;
  TechnicianContactID: number;
}>) {
  return ateraFetch(`/tickets/${ticketId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getAteraTicketComments(ticketId: number): Promise<{ items: AteraComment[] }> {
  return ateraFetch(`/tickets/${ticketId}/comments`);
}

export async function testAteraConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getAteraConfig();
    if (!config) return { success: false, error: "Clé API non configurée" };

    // Try to list tickets with a small page to test connectivity
    await ateraFetch("/tickets?page=1&itemsInPage=1");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur de connexion" };
  }
}

// ─── Customer (Company) Helpers ─────────────────────────

async function findOrCreateAteraCustomer(customerName: string): Promise<boolean> {
  try {
    const res = await ateraFetch(`/customers?page=1&itemsInPage=50&customerName=${encodeURIComponent(customerName)}`);
    const items = Array.isArray(res) ? res : (res?.items || []);
    if (items.length > 0) return true;

    // Customer doesn't exist — create it
    await ateraFetch("/customers", {
      method: "POST",
      body: JSON.stringify({ CustomerName: customerName }),
    });
    console.log(`[atera] Created customer in Atera: ${customerName}`);
    return true;
  } catch (err) {
    console.warn("[atera] Could not find/create Atera customer:", err);
    return false;
  }
}

// ─── End User / Contact Helpers ──────────────────────────

async function findOrCreateAteraEndUser(email: string, firstName: string, lastName: string, customerName?: string): Promise<string | undefined> {
  try {
    // Try to find existing contact by email
    const contacts = await ateraFetch(`/contacts?page=1&itemsInPage=50&email=${encodeURIComponent(email)}`);
    if (contacts?.items?.length > 0) {
      return email; // Contact exists, use the email
    }

    // Contact doesn't exist — create it
    const body: Record<string, string> = {
      Email: email,
      Firstname: firstName || "Client",
      Lastname: lastName || "",
    };
    if (customerName) body.CustomerName = customerName;

    await ateraFetch("/contacts", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return email;
  } catch (err) {
    console.warn("Could not find/create Atera end user:", err);
    return undefined; // Will create ticket without end user
  }
}

// ─── Sync Helpers ───────────────────────────────────────

/**
 * Sync a local ticket to Atera (create if new, update if exists)
 */
export async function syncTicketToAtera(ticketId: string): Promise<{ ateraId: number | null; error?: string }> {
  try {
    const config = await getAteraConfig();
    if (!config || !config.enabled) {
      return { ateraId: null, error: "Atera non configuré" };
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        client: { select: { name: true, email: true } },
        clientUser: { select: { name: true, email: true } },
      },
    });

    if (!ticket) return { ateraId: null, error: "Ticket introuvable" };

    // Split client user name for Atera
    const nameParts = (ticket.clientUser?.name || ticket.client.name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const endUserEmail = ticket.clientUser?.email || ticket.client.email || undefined;

    if (ticket.ateraId) {
      // Update existing
      await updateAteraTicket(ticket.ateraId, {
        TicketTitle: ticket.title,
        TicketStatus: ticket.status,
        TicketPriority: ticket.priority,
        TicketType: ticket.type,
        TicketImpact: ticket.impact,
      });

      await prisma.ticket.update({
        where: { id: ticketId },
        data: { ateraSynced: true, ateraSyncError: null },
      });

      return { ateraId: ticket.ateraId };
    } else {
      // Ensure customer (company) exists in Atera first
      const clientName = ticket.client.name || undefined;
      if (clientName) {
        await findOrCreateAteraCustomer(clientName);
      }

      // Ensure end user exists in Atera before creating ticket
      let resolvedEmail = endUserEmail;
      if (resolvedEmail) {
        resolvedEmail = await findOrCreateAteraEndUser(
          resolvedEmail,
          firstName,
          lastName,
          clientName,
        );
      }

      // Build ticket data — include CustomerName for Atera client association
      const ticketData: AteraTicketCreate = {
        TicketTitle: ticket.title,
        Description: `[${clientName || "Client"}] ${ticket.description}`,
        CustomerName: clientName,
        TicketPriority: ticket.priority,
        TicketType: ticket.type,
        TicketImpact: ticket.impact,
      };

      if (resolvedEmail) {
        ticketData.EndUserEmail = resolvedEmail;
        ticketData.EndUserFirstName = firstName;
        ticketData.EndUserLastName = lastName;
      }

      const result = await createAteraTicket(ticketData);

      // Atera returns ActionID (sometimes as string), parse to int
      const rawId = result?.TicketID ?? (result as unknown as { ActionID: string | number })?.ActionID;
      const ateraId = rawId ? (typeof rawId === "string" ? parseInt(rawId, 10) : rawId) : null;

      if (ateraId && !isNaN(ateraId)) {
        const ticketNumber = result?.TicketNumber || String(ateraId);
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            ateraId,
            ticketNumber,
            ateraSynced: true,
            ateraSyncError: null,
          },
        });
        return { ateraId };
      }

      return { ateraId: null, error: "Réponse Atera inattendue" };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Erreur sync Atera";
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { ateraSynced: false, ateraSyncError: error },
    }).catch(() => {});
    return { ateraId: null, error };
  }
}

// ─── Comment Sync (Comet → Atera) ──────────────────────

export async function addAteraTicketComment(
  ticketId: number,
  comment: string,
  isInternal: boolean = false
): Promise<void> {
  await ateraFetch(`/tickets/${ticketId}/comments`, {
    method: "POST",
    body: JSON.stringify({ Comment: comment, IsInternal: isInternal }),
  });
}

// ─── Bidirectional Sync (Atera → Comet) ────────────────

const ATERA_STATUS_MAP: Record<string, string> = {
  Open: "Open",
  Pending: "Pending",
  Resolved: "Resolved",
  Closed: "Closed",
  Waiting: "Pending",
  "In Progress": "Open",
};

function generateAteraCommentId(comment: string, date: string, email: string): string {
  // Simple hash for deduplication
  const raw = `${comment.trim().substring(0, 100)}|${date}|${email}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `atera_${Math.abs(hash).toString(36)}`;
}

/**
 * Sync all Atera-linked tickets from Atera back to Comet.
 * Called by cron scheduler every 5 minutes.
 */
export async function syncAllFromAtera(): Promise<{ synced: number; errors: number; skipped?: boolean }> {
  const config = await getAteraConfig();
  if (!config || !config.enabled) {
    console.log("[atera-sync] Atera non configuré ou désactivé, sync ignorée");
    return { synced: 0, errors: 0, skipped: true };
  }

  // Get all tickets with an ateraId, ordered by least recently synced first
  const tickets = await prisma.ticket.findMany({
    where: { ateraId: { not: null } },
    select: { id: true, ateraId: true, status: true, priority: true, type: true, impact: true, assignedTo: true },
    orderBy: { lastAteraSyncAt: { sort: "asc", nulls: "first" } },
    take: 50,
  });

  let synced = 0;
  let errors = 0;

  for (const ticket of tickets) {
    if (!ticket.ateraId) continue;

    try {
      // 1. Fetch ticket state from Atera
      const ateraTicket = await getAteraTicket(ticket.ateraId);
      if (!ateraTicket) {
        console.warn(`[atera-sync] No data returned from Atera for ticket ${ticket.ateraId}`);
        errors++;
        continue;
      }

      // 2. Compare and update fields
      const updates: Record<string, unknown> = {};
      const mappedStatus = ATERA_STATUS_MAP[ateraTicket.TicketStatus] || ateraTicket.TicketStatus;

      if (mappedStatus && mappedStatus !== ticket.status) {
        updates.status = mappedStatus;
        if (mappedStatus === "Resolved") updates.resolvedAt = new Date();
        if (mappedStatus === "Closed") updates.closedAt = new Date();
        // If reopened, clear resolved/closed dates
        if ((mappedStatus === "Open" || mappedStatus === "Pending") && (ticket.status === "Resolved" || ticket.status === "Closed")) {
          updates.resolvedAt = null;
          updates.closedAt = null;
        }
      }

      if (ateraTicket.TicketPriority && ateraTicket.TicketPriority !== ticket.priority) {
        updates.priority = ateraTicket.TicketPriority;
      }
      if (ateraTicket.TicketType && ateraTicket.TicketType !== ticket.type) {
        updates.type = ateraTicket.TicketType;
      }
      if (ateraTicket.TicketImpact && ateraTicket.TicketImpact !== ticket.impact) {
        updates.impact = ateraTicket.TicketImpact;
      }
      if (ateraTicket.TechnicianFullName && ateraTicket.TechnicianFullName !== ticket.assignedTo) {
        updates.assignedTo = ateraTicket.TechnicianFullName;
      }

      // Always update sync timestamp
      updates.lastAteraSyncAt = new Date();
      updates.ateraSynced = true;
      updates.ateraSyncError = null;

      if (Object.keys(updates).length > 1) { // more than just lastAteraSyncAt
        await prisma.ticket.update({ where: { id: ticket.id }, data: updates });
      } else {
        await prisma.ticket.update({ where: { id: ticket.id }, data: { lastAteraSyncAt: new Date() } });
      }

      // 3. Sync comments from Atera
      try {
        const commentsRes = await getAteraTicketComments(ticket.ateraId);
        const ateraComments: AteraComment[] = Array.isArray(commentsRes)
          ? commentsRes
          : (commentsRes?.items || []);

        // Get existing ateraCommentIds for this ticket
        const existingComments = await prisma.ticketComment.findMany({
          where: { ticketId: ticket.id, ateraCommentId: { not: null } },
          select: { ateraCommentId: true },
        });
        const existingIds = new Set(existingComments.map(c => c.ateraCommentId));

        for (const ac of ateraComments) {
          const commentId = generateAteraCommentId(ac.Comment, ac.Date, ac.Email);

          if (existingIds.has(commentId)) continue;

          // Check if a very similar comment already exists (fallback dedup)
          const commentContent = ac.Comment.trim();
          if (!commentContent) continue;

          const duplicate = await prisma.ticketComment.findFirst({
            where: {
              ticketId: ticket.id,
              content: commentContent,
              authorEmail: ac.Email || null,
            },
          });
          if (duplicate) {
            // Mark existing comment with ateraCommentId to avoid future checks
            await prisma.ticketComment.update({
              where: { id: duplicate.id },
              data: { ateraCommentId: commentId },
            });
            continue;
          }

          const authorName = [ac.FirstName, ac.LastName].filter(Boolean).join(" ") || ac.Email || "Atera";
          const isFromClient = ac.TechnicianContactID === 0 && ac.EndUserID > 0;

          await prisma.ticketComment.create({
            data: {
              ticketId: ticket.id,
              content: commentContent,
              authorName,
              authorEmail: ac.Email || null,
              isInternal: ac.IsInternal,
              isFromClient,
              ateraCommentId: commentId,
              createdAt: ac.Date ? new Date(ac.Date) : new Date(),
            },
          });
        }
      } catch (commentErr) {
        console.warn(`[atera-sync] Failed to sync comments for ticket ${ticket.id}:`, commentErr);
      }

      synced++;
    } catch (err) {
      errors++;
      const error = err instanceof Error ? err.message : "Erreur sync";
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { ateraSyncError: error },
      }).catch(() => {});
    }
  }

  return { synced, errors };
}
