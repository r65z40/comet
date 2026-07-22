"use client";

import { useEffect, useRef } from "react";
import type { BoardEvent } from "@/lib/board-events";

export interface MediaCommand {
  type: "video" | "video:control" | "spotify";
  url?: string;
  videoAction?: "play" | "pause" | "stop" | "mute" | "unmute";
  videoVolume?: number;
  spotifyUri?: string;
  spotifyAction?: "play" | "pause" | "next" | "prev";
  ts: number;
}

export function useMediaSync(onMediaCommand: (cmd: MediaCommand) => void) {
  const cbRef = useRef(onMediaCommand);
  cbRef.current = onMediaCommand;

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource("/api/board/events");

      es.addEventListener("board-update", (e) => {
        try {
          const evt: BoardEvent = JSON.parse(e.data);
          if (evt.type === "media:video" && evt.mediaUrl) {
            cbRef.current({ type: "video", url: evt.mediaUrl, ts: evt.ts });
          } else if (evt.type === "media:video:control") {
            cbRef.current({
              type: "video:control",
              videoAction: evt.videoAction,
              videoVolume: evt.videoVolume,
              ts: evt.ts,
            });
          } else if (evt.type === "media:spotify") {
            cbRef.current({
              type: "spotify",
              spotifyUri: evt.spotifyUri,
              spotifyAction: evt.spotifyAction,
              ts: evt.ts,
            });
          }
        } catch {}
      });

      es.onerror = () => {
        es?.close();
        es = null;
        if (!closed) reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, []);
}
