import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  syncProducts,
  syncClients,
  syncContacts,
  syncInvoices,
  generateInstallations,
  updateInstallationStatuses,
  cleanupStaleLogs,
} from "@/lib/axonaut";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { type } = body;

  try {
    let result;
    switch (type) {
      case "products":
        result = await syncProducts();
        break;
      case "clients":
        result = await syncClients();
        break;
      case "contacts":
        result = await syncContacts();
        break;
      case "invoices":
        result = await syncInvoices();
        break;
      case "installations":
        result = await generateInstallations();
        break;
      case "statuses":
        await updateInstallationStatuses();
        result = { success: true, message: "Statuts mis à jour" };
        break;
      case "full":
        const productsResult = await syncProducts();
        const clientsResult = await syncClients();
        const contactsResult = await syncContacts();
        const invoicesResult = await syncInvoices();
        const installationsResult = await generateInstallations();
        await updateInstallationStatuses();
        result = {
          success: true,
          details: {
            products: productsResult.count,
            clients: clientsResult.count,
            contacts: contactsResult.count,
            invoices: invoicesResult.count,
            installations: installationsResult.count,
          },
        };
        break;
      default:
        return NextResponse.json({ error: "Type de sync invalide" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de synchronisation" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // Clean up stale "running" logs older than 5 minutes
  await cleanupStaleLogs();

  const logs = await prisma.syncLog.findMany({
    where: { type: { not: "EMAIL_ALERT" } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ logs });
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  await prisma.syncLog.deleteMany({});

  return NextResponse.json({ success: true });
}
