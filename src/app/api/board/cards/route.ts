import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notifyUsers } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const card = await prisma.boardCard.findUnique({
      where: { id },
      include: {
        column: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, logoUrl: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        tags: { include: { tag: true } },
        comments: { orderBy: { createdAt: "desc" } },
        attachments: { orderBy: { createdAt: "desc" } },
        checklist: { orderBy: { position: "asc" } },
      },
    });

    if (!card) return NextResponse.json({ error: "Carte non trouvée" }, { status: 404 });
    return NextResponse.json(card);
  }

  return NextResponse.json({ error: "ID requis" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { columnId, title, description, priority, clientId, contactId, assigneeId, assigneeIds, dueDate, links, tagIds } = body;

  if (!columnId || !title?.trim()) {
    return NextResponse.json({ error: "Colonne et titre requis" }, { status: 400 });
  }

  const maxPos = await prisma.boardCard.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? -1) + 1;

  // Determine primary assignee and all assignees
  const allAssigneeIds: string[] = assigneeIds || (assigneeId ? [assigneeId] : []);
  const primaryAssigneeId = allAssigneeIds[0] || null;

  const card = await prisma.boardCard.create({
    data: {
      columnId,
      title: title.trim(),
      description: description || null,
      priority: priority || 3,
      position,
      clientId: clientId || null,
      contactId: contactId || null,
      assigneeId: primaryAssigneeId,
      assigneeIds: allAssigneeIds.length > 0 ? JSON.stringify(allAssigneeIds) : null,
      createdById: session.user?.id || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      links: links ? JSON.stringify(links) : null,
      movedToColumnAt: new Date(),
      ...(tagIds?.length && {
        tags: {
          create: tagIds.map((tagId: string) => ({ tagId })),
        },
      }),
    },
    include: {
      client: { select: { id: true, name: true, logoUrl: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      tags: { include: { tag: true } },
      checklist: { select: { id: true, checked: true } },
      _count: { select: { comments: true, attachments: true, checklist: true } },
    },
  });

  // Log history
  await prisma.cardHistory.create({
    data: {
      cardId: card.id,
      userId: session.user?.id || null,
      userName: session.user?.name || null,
      action: "CREATE",
      newValue: title.trim(),
    },
  });

  // Notify all assignees (except creator)
  await notifyUsers({
    userIds: allAssigneeIds,
    excludeUserId: session.user?.id,
    type: "card_assigned",
    title: "Nouvelle carte assignée",
    message: `${session.user?.name || "Un collaborateur"} vous a assigné la carte "${title.trim()}"`,
    link: `/board?card=${card.id}`,
  });

  return NextResponse.json(card, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { id, title, description, priority, clientId, contactId, assigneeId, assigneeIds, dueDate, links, tagIds } = body;

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existingCard = await prisma.boardCard.findUnique({ where: { id } });
  if (!existingCard) return NextResponse.json({ error: "Carte non trouvée" }, { status: 404 });

  // Track field changes for history
  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  const priorityLabels: Record<number, string> = { 1: "Urgente", 2: "Normale", 3: "Basse" };

  if (title !== undefined && title.trim() !== existingCard.title) {
    changes.push({ field: "title", oldValue: existingCard.title, newValue: title.trim() });
  }
  if (description !== undefined && description !== existingCard.description) {
    changes.push({ field: "description", oldValue: existingCard.description, newValue: description });
  }
  if (priority !== undefined && priority !== existingCard.priority) {
    changes.push({ field: "priority", oldValue: priorityLabels[existingCard.priority] || String(existingCard.priority), newValue: priorityLabels[priority] || String(priority) });
  }

  // Handle multiple assignees
  let newAssigneeIds: string[] | undefined;
  let primaryAssigneeId: string | undefined;

  if (assigneeIds !== undefined) {
    newAssigneeIds = assigneeIds as string[];
    primaryAssigneeId = newAssigneeIds[0] ?? undefined;

    const oldIds: string[] = existingCard.assigneeIds ? JSON.parse(existingCard.assigneeIds) : (existingCard.assigneeId ? [existingCard.assigneeId] : []);
    if (JSON.stringify(oldIds.sort()) !== JSON.stringify([...newAssigneeIds].sort())) {
      const oldNames = await Promise.all(oldIds.map(async (uid) => {
        const u = await prisma.user.findUnique({ where: { id: uid }, select: { name: true } });
        return u?.name || uid;
      }));
      const newNames = await Promise.all(newAssigneeIds.map(async (uid) => {
        const u = await prisma.user.findUnique({ where: { id: uid }, select: { name: true } });
        return u?.name || uid;
      }));
      changes.push({ field: "assignee", oldValue: oldNames.join(", ") || null, newValue: newNames.join(", ") || null });
    }
  } else if (assigneeId !== undefined && assigneeId !== existingCard.assigneeId) {
    primaryAssigneeId = assigneeId;
    newAssigneeIds = assigneeId ? [assigneeId] : [];
    const oldUser = existingCard.assigneeId ? await prisma.user.findUnique({ where: { id: existingCard.assigneeId }, select: { name: true } }) : null;
    const newUser = assigneeId ? await prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true } }) : null;
    changes.push({ field: "assignee", oldValue: oldUser?.name || null, newValue: newUser?.name || null });
  }

  if (clientId !== undefined && clientId !== existingCard.clientId) {
    const oldClient = existingCard.clientId ? await prisma.client.findUnique({ where: { id: existingCard.clientId }, select: { name: true } }) : null;
    const newClient = clientId ? await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }) : null;
    changes.push({ field: "client", oldValue: oldClient?.name || null, newValue: newClient?.name || null });
  }
  if (dueDate !== undefined) {
    const oldDate = existingCard.dueDate ? existingCard.dueDate.toISOString().split("T")[0] : null;
    const newDate = dueDate || null;
    if (oldDate !== newDate) {
      changes.push({ field: "dueDate", oldValue: oldDate, newValue: newDate });
    }
  }

  const card = await prisma.boardCard.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && { description }),
      ...(priority !== undefined && { priority }),
      ...(clientId !== undefined && { clientId: clientId || null }),
      ...(contactId !== undefined && { contactId: contactId || null }),
      ...(primaryAssigneeId !== undefined && { assigneeId: primaryAssigneeId || null }),
      ...(newAssigneeIds !== undefined && { assigneeIds: newAssigneeIds.length > 0 ? JSON.stringify(newAssigneeIds) : null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(links !== undefined && { links: links ? JSON.stringify(links) : null }),
    },
    include: {
      client: { select: { id: true, name: true, logoUrl: true } },
      contact: { select: { id: true, firstName: true, lastName: true } },
      tags: { include: { tag: true } },
      checklist: { select: { id: true, checked: true } },
      _count: { select: { comments: true, attachments: true, checklist: true } },
    },
  });

  // Log history for each changed field
  if (changes.length > 0) {
    await prisma.cardHistory.createMany({
      data: changes.map((change) => ({
        cardId: id,
        userId: session.user?.id || null,
        userName: session.user?.name || null,
        action: "UPDATE",
        field: change.field,
        oldValue: change.oldValue,
        newValue: change.newValue,
      })),
    });
  }

  // Update tags if provided
  if (tagIds !== undefined) {
    await prisma.cardTagLink.deleteMany({ where: { cardId: id } });
    if (tagIds.length > 0) {
      await prisma.cardTagLink.createMany({
        data: tagIds.map((tagId: string) => ({ cardId: id, tagId })),
      });
    }
  }

  // Notify new assignees
  if (newAssigneeIds !== undefined) {
    const oldIds: string[] = existingCard.assigneeIds ? JSON.parse(existingCard.assigneeIds) : (existingCard.assigneeId ? [existingCard.assigneeId] : []);
    const addedIds = newAssigneeIds.filter((uid) => !oldIds.includes(uid));
    await notifyUsers({
      userIds: addedIds,
      excludeUserId: session.user?.id,
      type: "card_assigned",
      title: "Carte assignée",
      message: `${session.user?.name || "Un collaborateur"} vous a assigné la carte "${card.title}"`,
      link: `/board?card=${card.id}`,
    });
  }

  // Notify if due date is set and card has assignees
  if (dueDate !== undefined && dueDate && !existingCard.dueDate) {
    const allIds: string[] = newAssigneeIds || (existingCard.assigneeIds ? JSON.parse(existingCard.assigneeIds) : (existingCard.assigneeId ? [existingCard.assigneeId] : []));
    await notifyUsers({
      userIds: allIds,
      excludeUserId: session.user?.id,
      type: "card_due",
      title: "Date limite ajoutée",
      message: `${session.user?.name || "Un collaborateur"} a ajouté une date limite au ${new Date(dueDate).toLocaleDateString("fr-FR")} sur "${card.title}"`,
      link: `/board?card=${card.id}`,
    });
  }

  return NextResponse.json(card);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.boardCard.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
