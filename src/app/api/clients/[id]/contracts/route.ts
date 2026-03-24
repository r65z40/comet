import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getAteraApiKey(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: "atera_api_key" } });
  return setting?.value || null;
}

interface AteraContract {
  ContractID: number;
  ContractName: string;
  ContractType: string;
  CustomerID: number;
  CustomerName: string;
  Active: boolean;
  StartDate: string;
  EndDate: string;
  BlockHoursContract?: {
    HoursIncluded: number;
    PricePerHour?: { Amount: number };
    OverageRate?: { Amount: number };
    CommitRollover: boolean;
    BillingPeriod: string;
  };
  HourlyContract?: {
    PricePerHour?: { Amount: number };
  };
  BlockMoneyContract?: {
    MoneyIncluded: number;
    PricePerHour?: { Amount: number };
  };
}

interface AteraTicketWithHours {
  TicketID: number;
  TicketTitle: string;
  TicketNumber: string;
  TicketStatus: string;
  TicketCreatedDate: string;
  TicketResolvedDate: string | null;
  ContractID: number | null;
  TotalWorkHours: number;
}

interface WorkHoursRecord {
  WorkHoursRecordID: number;
  TicketID: number;
  Duration: string; // ISO duration or decimal hours
  StartTime: string;
  EndTime: string;
  Billable: boolean;
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

  const client = await prisma.client.findUnique({ where: { id }, select: { name: true } });
  if (!client) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  try {
    // Find the Atera customer by name
    const customerId = await findAteraCustomerByName(apiKey, client.name);
    if (!customerId) {
      return NextResponse.json({ contracts: [], message: "Client non trouvé dans Atera" });
    }

    // Fetch contracts for this customer
    const contracts = await fetchAteraContracts(apiKey, customerId);

    // Fetch tickets for this customer
    const tickets = await fetchAteraTicketsWithHours(apiKey, customerId);

    // For each ticket, fetch work hours duration
    const ticketsWithHours: AteraTicketWithHours[] = [];
    for (const ticket of tickets) {
      const hours = await fetchTicketWorkHours(apiKey, ticket.TicketID);
      ticketsWithHours.push({
        TicketID: ticket.TicketID,
        TicketTitle: ticket.TicketTitle,
        TicketNumber: ticket.TicketNumber,
        TicketStatus: ticket.TicketStatus,
        TicketCreatedDate: ticket.TicketCreatedDate,
        TicketResolvedDate: ticket.TicketResolvedDate,
        ContractID: ticket.ContractID ?? null,
        TotalWorkHours: hours,
      });
    }

    // Build contract summaries with associated tickets
    const contractSummaries = contracts.map((contract) => {
      const contractTickets = ticketsWithHours.filter(t => t.ContractID === contract.ContractID);
      const totalUsedHours = contractTickets.reduce((sum, t) => sum + t.TotalWorkHours, 0);

      let hoursIncluded = 0;
      let contractTypeLabel = contract.ContractType;

      if (contract.BlockHoursContract) {
        hoursIncluded = contract.BlockHoursContract.HoursIncluded || 0;
        contractTypeLabel = "Pack d'heures";
      } else if (contract.HourlyContract) {
        contractTypeLabel = "Horaire";
      } else if (contract.BlockMoneyContract) {
        contractTypeLabel = "Forfait";
      }

      const hoursRemaining = Math.max(0, hoursIncluded - totalUsedHours);
      const overage = Math.max(0, totalUsedHours - hoursIncluded);

      return {
        contractId: contract.ContractID,
        contractName: contract.ContractName,
        contractType: contractTypeLabel,
        active: contract.Active,
        startDate: contract.StartDate,
        endDate: contract.EndDate,
        hoursIncluded,
        hoursUsed: Math.round(totalUsedHours * 100) / 100,
        hoursRemaining: Math.round(hoursRemaining * 100) / 100,
        overage: Math.round(overage * 100) / 100,
        ticketCount: contractTickets.length,
        tickets: contractTickets.map(t => ({
          ticketId: t.TicketID,
          ticketNumber: t.TicketNumber,
          title: t.TicketTitle,
          status: t.TicketStatus,
          createdDate: t.TicketCreatedDate,
          resolvedDate: t.TicketResolvedDate,
          workHours: Math.round(t.TotalWorkHours * 100) / 100,
        })),
      };
    });

    // Also include tickets not assigned to any contract
    const unassignedTickets = ticketsWithHours.filter(t => !t.ContractID || !contracts.some(c => c.ContractID === t.ContractID));
    const totalUsedAll = ticketsWithHours.reduce((sum, t) => sum + t.TotalWorkHours, 0);
    const totalIncluded = contracts.reduce((sum, c) => sum + (c.BlockHoursContract?.HoursIncluded || 0), 0);
    const totalRemaining = Math.max(0, totalIncluded - totalUsedAll);
    const totalOverage = Math.max(0, totalUsedAll - totalIncluded);

    return NextResponse.json({
      summary: {
        totalHoursUsed: Math.round(totalUsedAll * 100) / 100,
        totalHoursRemaining: Math.round(totalRemaining * 100) / 100,
        totalOverage: Math.round(totalOverage * 100) / 100,
      },
      contracts: contractSummaries,
      unassignedTickets: unassignedTickets.map(t => ({
        ticketId: t.TicketID,
        ticketNumber: t.TicketNumber,
        title: t.TicketTitle,
        status: t.TicketStatus,
        createdDate: t.TicketCreatedDate,
        resolvedDate: t.TicketResolvedDate,
        workHours: Math.round(t.TotalWorkHours * 100) / 100,
      })),
    });
  } catch (error) {
    console.error("Atera contracts API error:", error);
    return NextResponse.json({ error: "Erreur lors de la communication avec Atera" }, { status: 502 });
  }
}

async function findAteraCustomerByName(apiKey: string, clientName: string): Promise<number | null> {
  let page = 1;
  const itemsInPage = 50;

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
    if (page > 100) break;
  }

  return null;
}

async function fetchAteraContracts(apiKey: string, customerId: number): Promise<AteraContract[]> {
  const allContracts: AteraContract[] = [];
  let page = 1;
  const itemsInPage = 50;

  while (true) {
    const res = await fetch(
      `https://app.atera.com/api/v3/contracts/customer/${customerId}?page=${page}&itemsInPage=${itemsInPage}`,
      { headers: { "X-API-KEY": apiKey, Accept: "application/json" } }
    );
    if (!res.ok) throw new Error(`Atera contracts API returned ${res.status}`);

    const data = await res.json();
    const items = data.items || [];
    allContracts.push(...items);

    if (items.length < itemsInPage) break;
    page++;
    if (page > 20) break;
  }

  return allContracts;
}

interface AteraTicketBasic {
  TicketID: number;
  TicketTitle: string;
  TicketNumber: string;
  TicketStatus: string;
  TicketCreatedDate: string;
  TicketResolvedDate: string | null;
  ContractID: number | null;
}

async function fetchAteraTicketsWithHours(apiKey: string, customerId: number): Promise<AteraTicketBasic[]> {
  const allTickets: AteraTicketBasic[] = [];
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
    if (page > 20) break;
  }

  return allTickets;
}

async function fetchTicketWorkHours(apiKey: string, ticketId: number): Promise<number> {
  try {
    const res = await fetch(
      `https://app.atera.com/api/v3/tickets/${ticketId}/workhours`,
      { headers: { "X-API-KEY": apiKey, Accept: "application/json" } }
    );
    if (!res.ok) return 0;

    const data = await res.json();
    return data.TotalWorkHours || data.totalDurationHours || data.total_duration_hours || 0;
  } catch {
    return 0;
  }
}
