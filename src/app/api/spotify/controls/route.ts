import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { spotifyFetch } from "@/lib/spotify";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { action } = await req.json();

  try {
    let res: Response;
    switch (action) {
      case "pause":
        res = await spotifyFetch("/me/player/pause", { method: "PUT" });
        break;
      case "resume":
        res = await spotifyFetch("/me/player/play", { method: "PUT" });
        break;
      case "next":
        res = await spotifyFetch("/me/player/next", { method: "POST" });
        break;
      case "previous":
        res = await spotifyFetch("/me/player/previous", { method: "POST" });
        break;
      case "shuffle":
        res = await spotifyFetch("/me/player/shuffle?state=true", { method: "PUT" });
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    if (!res.ok && res.status !== 204) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
