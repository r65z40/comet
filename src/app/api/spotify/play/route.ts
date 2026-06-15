import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spotifyFetch, getDevices } from "@/lib/spotify";

async function findDeviceId(preferredId?: string): Promise<string | null> {
  if (preferredId) return preferredId;

  try {
    const data = await getDevices();
    const devices = data.devices || [];
    const active = devices.find((d: Record<string, unknown>) => d.is_active);
    if (active) return active.id as string;
    if (devices.length > 0) return devices[0].id as string;
  } catch {}

  return null;
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { uri, contextUri, deviceId: preferredDeviceId } = body;

  try {
    const deviceId = await findDeviceId(preferredDeviceId);
    if (!deviceId) {
      return NextResponse.json({ error: "NO_DEVICE: Ouvrez Spotify sur un appareil (téléphone, PC, etc.)" }, { status: 404 });
    }

    const params = `?device_id=${deviceId}`;
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
