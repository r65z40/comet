import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function computeKpis(
  invoices: Array<{
    totalAmount: number | null;
    status: string | null;
    invoiceDate: Date;
    client: { id: string; name: string };
    lines: Array<{
      totalPrice: number | null;
      purchasePrice: number | null;
      quantity: number;
      product: { id: string; name: string; family: string | null; supplier: string | null } | null;
    }>;
  }>,
  filterByLine: boolean,
) {
  let totalRevenue = 0;
  let totalCost = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  let linesWithoutCost = 0;
  let totalLines = 0;

  for (const inv of invoices) {
    const amount = filterByLine
      ? inv.lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0)
      : (inv.totalAmount ?? inv.lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0));
    totalRevenue += amount;

    for (const line of inv.lines) {
      totalLines++;
      const cost = line.purchasePrice ?? 0;
      if (cost === 0) linesWithoutCost++;
      totalCost += cost * (line.quantity ?? 1);
    }

    const s = inv.status?.toLowerCase();
    const isPaid = s === "paid" || s === "payée" || s === "payé";
    if (isPaid) {
      totalPaid += amount;
    } else {
      totalUnpaid += amount;
    }
  }

  const margin = totalRevenue - totalCost;
  const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
    invoiceCount: invoices.length,
    averageInvoice: invoices.length > 0 ? Math.round((totalRevenue / invoices.length) * 100) / 100 : 0,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalUnpaid: Math.round(totalUnpaid * 100) / 100,
    unpaidCount: invoices.filter((inv) => {
      const st = inv.status?.toLowerCase();
      return st !== "paid" && st !== "payée" && st !== "payé";
    }).length,
    linesWithoutCost,
    totalLines,
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const clientId = searchParams.get("clientId");
  const family = searchParams.get("family");
  const supplier = searchParams.get("supplier");

  const dateFrom = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const dateTo = to ? new Date(to + "T23:59:59") : new Date();

  const durationMs = dateTo.getTime() - dateFrom.getTime();
  const prevTo = new Date(dateFrom.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  const filterByLine = !!(family || supplier);

  const invoiceWhere: Record<string, unknown> = {
    invoiceDate: { gte: dateFrom, lte: dateTo },
  };
  if (clientId) invoiceWhere.clientId = clientId;

  const prevInvoiceWhere: Record<string, unknown> = {
    invoiceDate: { gte: prevFrom, lte: prevTo },
  };
  if (clientId) prevInvoiceWhere.clientId = clientId;

  const lineWhere: Record<string, unknown> = {};
  if (family || supplier) {
    lineWhere.product = {};
    if (family) (lineWhere.product as Record<string, unknown>).family = family;
    if (supplier) (lineWhere.product as Record<string, unknown>).supplier = supplier;
  }

  const lineInclude = {
    where: Object.keys(lineWhere).length > 0 ? lineWhere : undefined,
    include: { product: { select: { id: true, name: true, family: true, supplier: true } } },
  };

  const [invoices, prevInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        client: { select: { id: true, name: true } },
        lines: lineInclude,
      },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.invoice.findMany({
      where: prevInvoiceWhere,
      include: {
        client: { select: { id: true, name: true } },
        lines: lineInclude,
      },
      orderBy: { invoiceDate: "desc" },
    }),
  ]);

  const currentKpis = computeKpis(invoices, filterByLine);
  const prevKpis = computeKpis(prevInvoices, filterByLine);

  const unpaidInvoices = invoices.filter((inv) => {
    const s = inv.status?.toLowerCase();
    return s !== "paid" && s !== "payée" && s !== "payé";
  });

  // Revenue by month
  const revenueByMonth: Record<string, { revenue: number; cost: number; count: number }> = {};
  for (const inv of invoices) {
    const key = inv.invoiceDate.toISOString().slice(0, 7);
    if (!revenueByMonth[key]) revenueByMonth[key] = { revenue: 0, cost: 0, count: 0 };
    const amount = filterByLine
      ? inv.lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0)
      : (inv.totalAmount ?? inv.lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0));
    revenueByMonth[key].revenue += amount;
    revenueByMonth[key].count += 1;
    for (const line of inv.lines) {
      revenueByMonth[key].cost += (line.purchasePrice ?? 0) * (line.quantity ?? 1);
    }
  }

  const monthlyData = Object.entries(revenueByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      revenue: Math.round(data.revenue * 100) / 100,
      cost: Math.round(data.cost * 100) / 100,
      margin: Math.round((data.revenue - data.cost) * 100) / 100,
      count: data.count,
    }));

  // Revenue by family
  const byFamily: Record<string, { revenue: number; cost: number; count: number }> = {};
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const f = line.product?.family || "Sans famille";
      if (!byFamily[f]) byFamily[f] = { revenue: 0, cost: 0, count: 0 };
      byFamily[f].revenue += line.totalPrice ?? 0;
      byFamily[f].cost += (line.purchasePrice ?? 0) * (line.quantity ?? 1);
      byFamily[f].count += 1;
    }
  }
  const familyData = Object.entries(byFamily)
    .map(([name, data]) => ({ name, revenue: Math.round(data.revenue * 100) / 100, cost: Math.round(data.cost * 100) / 100, count: data.count }))
    .sort((a, b) => b.revenue - a.revenue);

  // Revenue by supplier
  const bySupplier: Record<string, { revenue: number; cost: number; count: number }> = {};
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const s = line.product?.supplier || "Sans fournisseur";
      if (!bySupplier[s]) bySupplier[s] = { revenue: 0, cost: 0, count: 0 };
      bySupplier[s].revenue += line.totalPrice ?? 0;
      bySupplier[s].cost += (line.purchasePrice ?? 0) * (line.quantity ?? 1);
      bySupplier[s].count += 1;
    }
  }
  const supplierData = Object.entries(bySupplier)
    .map(([name, data]) => ({ name, revenue: Math.round(data.revenue * 100) / 100, cost: Math.round(data.cost * 100) / 100, count: data.count }))
    .sort((a, b) => b.revenue - a.revenue);

  // Top clients with margin
  const byClient: Record<string, { id: string; name: string; revenue: number; cost: number; invoiceCount: number }> = {};
  for (const inv of invoices) {
    const cid = inv.client.id;
    if (!byClient[cid]) byClient[cid] = { id: cid, name: inv.client.name, revenue: 0, cost: 0, invoiceCount: 0 };
    const amount = filterByLine
      ? inv.lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0)
      : (inv.totalAmount ?? inv.lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0));
    byClient[cid].revenue += amount;
    byClient[cid].invoiceCount += 1;
    for (const line of inv.lines) {
      byClient[cid].cost += (line.purchasePrice ?? 0) * (line.quantity ?? 1);
    }
  }
  const allClientsSorted = Object.values(byClient).sort((a, b) => b.revenue - a.revenue);
  const topClients = allClientsSorted
    .slice(0, 10)
    .map((c) => ({
      ...c,
      revenue: Math.round(c.revenue * 100) / 100,
      cost: Math.round(c.cost * 100) / 100,
      margin: Math.round((c.revenue - c.cost) * 100) / 100,
    }));

  // Client concentration: top 3 share
  const top3Revenue = allClientsSorted.slice(0, 3).reduce((s, c) => s + c.revenue, 0);
  const clientConcentration = currentKpis.totalRevenue > 0
    ? Math.round((top3Revenue / currentKpis.totalRevenue) * 1000) / 10
    : 0;

  // Top products
  const byProduct: Record<string, { id: string; name: string; revenue: number; quantity: number; cost: number }> = {};
  for (const inv of invoices) {
    for (const line of inv.lines) {
      const pid = line.product?.id || "unknown";
      const pname = line.product?.name || line.description || "Inconnu";
      if (!byProduct[pid]) byProduct[pid] = { id: pid, name: pname, revenue: 0, quantity: 0, cost: 0 };
      byProduct[pid].revenue += line.totalPrice ?? 0;
      byProduct[pid].quantity += line.quantity ?? 1;
      byProduct[pid].cost += (line.purchasePrice ?? 0) * (line.quantity ?? 1);
    }
  }
  const topProducts = Object.values(byProduct)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((p) => ({ ...p, revenue: Math.round(p.revenue * 100) / 100, cost: Math.round(p.cost * 100) / 100, margin: Math.round((p.revenue - p.cost) * 100) / 100 }));

  // Installations stats
  const now = new Date();
  const in90Days = new Date(now.getTime() + 90 * 86400000);
  const installWhere: Record<string, unknown> = { deletedAt: null, status: "EN_PARC" };
  if (clientId) installWhere.clientId = clientId;
  if (family) installWhere.family = family;
  if (supplier) installWhere.supplier = supplier;

  const [activeInstallations, renewalInstallations] = await Promise.all([
    prisma.installation.count({ where: installWhere }),
    prisma.installation.count({ where: { ...installWhere, endDate: { gte: now, lte: in90Days } } }),
  ]);

  // Unpaid invoices detail
  const unpaidDetail = unpaidInvoices.slice(0, 20).map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    clientName: inv.client.name,
    clientId: inv.client.id,
    date: inv.invoiceDate,
    amount: inv.totalAmount ?? inv.lines.reduce((s, l) => s + (l.totalPrice ?? 0), 0),
    status: inv.status,
  }));

  // Available filter values
  const families = await prisma.product.findMany({
    where: { deletedAt: null, family: { not: null } },
    select: { family: true },
    distinct: ["family"],
    orderBy: { family: "asc" },
  });
  const suppliers = await prisma.product.findMany({
    where: { deletedAt: null, supplier: { not: null } },
    select: { supplier: true },
    distinct: ["supplier"],
    orderBy: { supplier: "asc" },
  });

  return NextResponse.json({
    kpis: {
      ...currentKpis,
      activeInstallations,
      renewalInstallations,
    },
    previousKpis: {
      totalRevenue: prevKpis.totalRevenue,
      totalCost: prevKpis.totalCost,
      margin: prevKpis.margin,
      marginPercent: prevKpis.marginPercent,
      invoiceCount: prevKpis.invoiceCount,
      averageInvoice: prevKpis.averageInvoice,
      totalPaid: prevKpis.totalPaid,
      totalUnpaid: prevKpis.totalUnpaid,
      unpaidCount: prevKpis.unpaidCount,
    },
    clientConcentration,
    monthlyData,
    familyData,
    supplierData,
    topClients,
    topProducts,
    unpaidDetail,
    filters: {
      families: families.map((f) => f.family).filter(Boolean) as string[],
      suppliers: suppliers.map((s) => s.supplier).filter(Boolean) as string[],
    },
  });
}
