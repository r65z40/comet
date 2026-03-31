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
      // Create new
      const result = await createAteraTicket({
        TicketTitle: ticket.title,
        Description: ticket.description,
        EndUserEmail: ticket.clientUser?.email || ticket.client.email || undefined,
        EndUserFirstName: firstName,
        EndUserLastName: lastName,
        TicketPriority: ticket.priority,
        TicketType: ticket.type,
        TicketImpact: ticket.impact,
      });

      const ateraId = result?.TicketID || (result as unknown as { ActionID: number })?.ActionID;

      if (ateraId) {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            ateraId,
            ticketNumber: result?.TicketNumber || String(ateraId),
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
