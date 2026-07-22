import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { boardEvents } from "@/lib/board-events";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { type, url, uri, action } = body as {
    type: "video" | "spotify";
    url?: string;
    uri?: string;
    action?: "play" | "pause" | "next" | "prev";
  };

  if (type === "video") {
    if (!url) return NextResponse.json({ error: "URL requise" }, { status: 400 });
    boardEvents.emit({
      type: "media:video",
      mediaUrl: url,
      userId: session.user.id,
    });
    return NextResponse.json({ ok: true });
  }

  if (type === "spotify") {
    boardEvents.emit({
      type: "media:spotify",
      spotifyUri: uri,
      spotifyAction: action || "play",
      userId: session.user.id,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Type invalide" }, { status: 400 });
}
