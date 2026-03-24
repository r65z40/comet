import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getAteraApiKey(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: "atera_api_key" } });
  return setting?.value || null;
}

interface AteraTicket {
  TicketID: number;
  TicketTitle: string;
  TicketNumber: string;
  TicketPriority: string;
  TicketStatus: string;
  TicketType: string;
  TicketCreatedDate: string;
  TicketResolvedDate: string | null;
  CustomerID: number;
  CustomerName: string;
  EndUserFirstName: string;
  EndUserLastName: string;
  TechnicianFullName: string;
  FirstComment: string;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const apiKey = await getAteraApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Atera non configurée" }, { status: 400 });
  }

  // Get client name to match with Atera customer
  const client = await prisma.client.findUnique({ where: { id }, select: { name: true } });
  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  try {
    // First, find the Atera customer by name
    const customerId = await findAteraCustomerByName(apiKey, client.name);
    if (!customerId) {
      return NextResponse.json({ tickets: [], message: "Client non trouvé dans Atera" });
    }

    // Fetch tickets for this customer
    const tickets = await fetchAteraTickets(apiKey, customerId);
    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Atera API error:", error);
    return NextResponse.json({ error: "Erreur lors de la communication avec Atera" }, { status: 502 });
  }
}

async function findAteraCustomerByName(apiKey: string, clientName: string): Promise<number | null> {
  let page = 1;
  const itemsInPage = 50;

  // Paginate through customers to find by name
  while (true) {
    const res = await fetch(
      `https://app.atera.com/api/v3/customers?page=${page}&itemsInPage=${itemsInPage}`,
      { headers: { "X-API-KEY": apiKey, Accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`Atera customers API returned ${res.status}`);

    const data = await res.json();
    const items = data.items || [];

    for (const customer of items) {
      if (customer.CustomerName?.toLowerCase().trim() === clientName.toLowerCase().trim()) {
        return customer.CustomerID;
      }
    }

    if (items.length < itemsInPage) break;
    page++;
    if (page > 100) break; // safety limit
  }

  return null;
}

async function fetchAteraTickets(apiKey: string, customerId: number): Promise<AteraTicket[]> {
  const allTickets: AteraTicket[] = [];
  let page = 1;
  const itemsInPage = 50;

  while (true) {
    const res = await fetch(
      `https://app.atera.com/api/v3/tickets?customerId=${customerId}&page=${page}&itemsInPage=${itemsInPage}`,
      { headers: { "X-API-KEY": apiKey, Accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`Atera tickets API returned ${res.status}`);

    const data = await res.json();
    const items = data.items || [];
    allTickets.push(...items);

    if (items.length < itemsInPage) break;
    page++;
    if (page > 20) break; // safety limit
  }

  // Sort by creation date descending (newest first)
  allTickets.sort((a, b) => new Date(b.TicketCreatedDate).getTime() - new Date(a.TicketCreatedDate).getTime());

  return allTickets;
}
