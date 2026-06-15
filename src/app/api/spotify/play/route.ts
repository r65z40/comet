import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spotifyFetch } from "@/lib/spotify";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { uri, contextUri, deviceId } = body;

  try {
    const params = deviceId ? `?device_id=${deviceId}` : "";
    const playBody: Record<string, unknown> = {};

    if (contextUri) {
      playBody.context_uri = contextUri;
      if (uri) {
        playBody.offset = { uri };
      }
    } else if (uri) {
      playBody.uris = [uri];
    }

    const res = await spotifyFetch(`/me/player/play${params}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(playBody),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Play failed" }, { status: 500 });
  }
}
