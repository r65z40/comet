import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

async function getAteraApiKey(): Promise<string | null> {
  const setting = await prisma.setting.findUnique({ where: { key: "atera_api_key" } });
  return setting?.value || null;
}

interface AteraCustomer {
  CustomerID: number;
  CustomerName: string;
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
  };
  HourlyContract?: {
    PricePerHour?: { Amount: number };
  };
  BlockMoneyContract?: {
    MoneyIncluded: number;
    PricePerHour?: { Amount: number };
  };
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
  TechnicianFullName: string;
  ContractID: number | null;
}

const headers = (apiKey: string) => ({
  "X-API-KEY": apiKey,
  Accept: "application/json",
});

async function fetchAllCustomers(apiKey: string): Promise<AteraCustomer[]> {
  const all: AteraCustomer[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://app.atera.com/api/v3/customers?page=${page}&itemsInPage=50`,
      { headers: headers(apiKey) }
    );
    if (!res.ok) throw new Error(`Atera customers API returned ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    all.push(...items);
    if (items.length < 50) break;
    page++;
    if (page > 100) break;
  }
  return all;
}

async function fetchCustomerTickets(apiKey: string, customerId: number): Promise<AteraTicket[]> {
  const all: AteraTicket[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://app.atera.com/api/v3/tickets?customerId=${customerId}&page=${page}&itemsInPage=50`,
      { headers: headers(apiKey) }
    );
    if (!res.ok) throw new Error(`Atera tickets API returned ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    all.push(...items);
    if (items.length < 50) break;
    page++;
    if (page > 20) break;
  }
  return all;
}

async function fetchCustomerContracts(apiKey: string, customerId: number): Promise<AteraContract[]> {
  const all: AteraContract[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://app.atera.com/api/v3/contracts/customer/${customerId}?page=${page}&itemsInPage=50`,
      { headers: headers(apiKey) }
    );
    if (!res.ok) throw new Error(`Atera contracts API returned ${res.status}`);
    const data = await res.json();
    const items = data.items || [];
    all.push(...items);
    if (items.length < 50) break;
    page++;
    if (page > 20) break;
  }
  return all;
}

async function fetchTicketWorkHours(apiKey: string, ticketId: number): Promise<number> {
  try {
    const res = await fetch(
      `https://app.atera.com/api/v3/tickets/${ticketId}/workhours`,
      { headers: headers(apiKey) }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.TotalWorkHours || data.totalDurationHours || data.total_duration_hours || 0;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const apiKey = await getAteraApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Atera non configurée" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const customerFilter = searchParams.get("customer"); // optional: filter by customer name

  try {
    // Get all Atera customers
    let customers = await fetchAllCustomers(apiKey);

    // Optionally match with COMET clients
    const cometClients = await prisma.client.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });
    const cometClientNames = new Set(cometClients.map(c => c.name.toLowerCase().trim()));

    // Only keep customers that exist in COMET (for relevance)
    const matchedCustomers = customers.filter(c =>
      cometClientNames.has(c.CustomerName?.toLowerCase().trim() || "")
    );

    // If a specific customer is requested, filter further
    const targetCustomers = customerFilter
      ? matchedCustomers.filter(c =>
          c.CustomerName?.toLowerCase().includes(customerFilter.toLowerCase())
        )
      : matchedCustomers;

    // Fetch data for each customer (limited to avoid API overload)
    const maxCustomers = targetCustomers.slice(0, 50);

    const customerReports = [];
    const allTickets: (AteraTicket & { workHours: number; customerName: string })[] = [];
    const allContracts: (AteraContract & { hoursUsed: number })[] = [];

    for (const customer of maxCustomers) {
      const [tickets, contracts] = await Promise.all([
        fetchCustomerTickets(apiKey, customer.CustomerID),
        fetchCustomerContracts(apiKey, customer.CustomerID),
      ]);

      // Fetch work hours for each ticket
      const ticketsWithHours = [];
      for (const ticket of tickets) {
        const hours = await fetchTicketWorkHours(apiKey, ticket.TicketID);
        ticketsWithHours.push({
          ...ticket,
          workHours: Math.round(hours * 100) / 100,
          customerName: customer.CustomerName,
        });
        allTickets.push({
          ...ticket,
          workHours: Math.round(hours * 100) / 100,
          customerName: customer.CustomerName,
        });
      }

      // Calculate hours used per contract
      for (const contract of contracts) {
        const contractTickets = ticketsWithHours.filter(t => t.ContractID === contract.ContractID);
        const hoursUsed = contractTickets.reduce((sum, t) => sum + t.workHours, 0);
        allContracts.push({
          ...contract,
          hoursUsed: Math.round(hoursUsed * 100) / 100,
        });
      }

      const totalHoursUsed = ticketsWithHours.reduce((sum, t) => sum + t.workHours, 0);
      const totalHoursIncluded = contracts.reduce(
        (sum, c) => sum + (c.BlockHoursContract?.HoursIncluded || 0),
        0
      );

      // Find matching COMET client
      const cometClient = cometClients.find(
        c => c.name.toLowerCase().trim() === customer.CustomerName?.toLowerCase().trim()
      );

      customerReports.push({
        customerId: customer.CustomerID,
        customerName: customer.CustomerName,
        cometClientId: cometClient?.id || null,
        ticketCount: tickets.length,
        openTickets: tickets.filter(t => t.TicketStatus === "Open").length,
        pendingTickets: tickets.filter(t => t.TicketStatus === "Pending").length,
        resolvedTickets: tickets.filter(t => t.TicketStatus === "Resolved" || t.TicketStatus === "Closed").length,
        totalHoursUsed: Math.round(totalHoursUsed * 100) / 100,
        totalHoursIncluded,
        hoursRemaining: Math.round(Math.max(0, totalHoursIncluded - totalHoursUsed) * 100) / 100,
        overage: Math.round(Math.max(0, totalHoursUsed - totalHoursIncluded) * 100) / 100,
        contractCount: contracts.length,
      });
    }

    // Build aggregated stats
    const totalTickets = allTickets.length;
    const totalHours = Math.round(allTickets.reduce((s, t) => s + t.workHours, 0) * 100) / 100;
    const openTickets = allTickets.filter(t => t.TicketStatus === "Open").length;
    const resolvedTickets = allTickets.filter(t => t.TicketStatus === "Resolved" || t.TicketStatus === "Closed").length;
    const totalIncluded = allContracts.reduce((s, c) => s + (c.BlockHoursContract?.HoursIncluded || 0), 0);

    // Tickets by status
    const statusMap: Record<string, number> = {};
    for (const t of allTickets) {
      statusMap[t.TicketStatus] = (statusMap[t.TicketStatus] || 0) + 1;
    }

    // Tickets by month (last 12 months)
    const monthlyMap: Record<string, { tickets: number; hours: number }> = {};
    for (const t of allTickets) {
      const d = new Date(t.TicketCreatedDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap[key]) monthlyMap[key] = { tickets: 0, hours: 0 };
      monthlyMap[key].tickets++;
      monthlyMap[key].hours += t.workHours;
    }
    const monthlyData = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        month,
        tickets: data.tickets,
        hours: Math.round(data.hours * 100) / 100,
      }));

    // Hours by technician
    const techMap: Record<string, { hours: number; tickets: number }> = {};
    for (const t of allTickets) {
      const tech = t.TechnicianFullName || "Non assigné";
      if (!techMap[tech]) techMap[tech] = { hours: 0, tickets: 0 };
      techMap[tech].hours += t.workHours;
      techMap[tech].tickets++;
    }
    const byTechnician = Object.entries(techMap)
      .map(([name, data]) => ({
        name,
        hours: Math.round(data.hours * 100) / 100,
        tickets: data.tickets,
      }))
      .sort((a, b) => b.hours - a.hours);

    // Recent tickets (last 20)
    const recentTickets = [...allTickets]
      .sort((a, b) => new Date(b.TicketCreatedDate).getTime() - new Date(a.TicketCreatedDate).getTime())
      .slice(0, 20)
      .map(t => ({
        ticketId: t.TicketID,
        ticketNumber: t.TicketNumber,
        title: t.TicketTitle,
        status: t.TicketStatus,
        priority: t.TicketPriority,
        customerName: t.customerName,
        technician: t.TechnicianFullName || "Non assigné",
        createdDate: t.TicketCreatedDate,
        resolvedDate: t.TicketResolvedDate,
        workHours: t.workHours,
      }));

    return NextResponse.json({
      summary: {
        totalTickets,
        totalHours,
        openTickets,
        resolvedTickets,
        totalHoursIncluded: totalIncluded,
        totalOverage: Math.round(Math.max(0, totalHours - totalIncluded) * 100) / 100,
        customerCount: maxCustomers.length,
        contractCount: allContracts.length,
      },
      byStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
      byMonth: monthlyData,
      byTechnician,
      byCustomer: customerReports.sort((a, b) => b.totalHoursUsed - a.totalHoursUsed),
      recentTickets,
    });
  } catch (error) {
    console.error("Atera report API error:", error);
    return NextResponse.json({ error: "Erreur lors de la communication avec Atera" }, { status: 502 });
  }
}
