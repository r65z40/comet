import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitize";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  let note = await prisma.boardNote.findFirst();
  if (!note) {
    note = await prisma.boardNote.create({ data: { content: "" } });
  }

  return NextResponse.json(note);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const sanitizedContent = sanitizeHtml(body.content || "");

  let note = await prisma.boardNote.findFirst();
  if (!note) {
    note = await prisma.boardNote.create({
      data: { content: sanitizedContent, updatedBy: session.user?.name || null },
    });
  } else {
    note = await prisma.boardNote.update({
      where: { id: note.id },
      data: { content: sanitizedContent, updatedBy: session.user?.name || null },
    });
  }

  return NextResponse.json(note);
}
