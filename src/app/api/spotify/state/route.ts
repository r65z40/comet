import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentPlayback } from "@/lib/spotify";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  try {
    const data = await getCurrentPlayback();
    if (!data || !data.item) {
      return NextResponse.json({ playing: false });
    }

    const track = data.item;
    const album = track.album || {};
    const images = album.images || [];
    const artists = (track.artists || []).map((a: { name: string }) => a.name).join(", ");

    return NextResponse.json({
      playing: data.is_playing,
      paused: !data.is_playing,
      trackName: track.name,
      artistName: artists,
      albumImage: images[0]?.url || "",
      positionMs: data.progress_ms || 0,
      durationMs: track.duration_ms || 0,
      deviceName: data.device?.name || "",
    });
  } catch {
    return NextResponse.json({ playing: false });
  }
}
