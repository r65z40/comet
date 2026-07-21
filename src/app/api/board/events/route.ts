import { boardEvents } from "@/lib/board-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function send(data: string, event?: string) {
        try {
          if (event) controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {}
      }

      send(JSON.stringify({ type: "connected", ts: Date.now() }));

      const unsubscribe = boardEvents.subscribe((evt) => {
        send(JSON.stringify(evt), "board-update");
      });

      const heartbeat = setInterval(() => {
        send("", "heartbeat");
      }, 30_000);

      const cleanup = () => {
        unsubscribe();
        clearInterval(heartbeat);
      };

      // AbortSignal not available on ReadableStream controller in all runtimes,
      // so we store cleanup for the cancel callback
      (controller as unknown as Record<string, unknown>).__cleanup = cleanup;
    },
    cancel(controller) {
      const cleanup = (controller as unknown as Record<string, unknown>).__cleanup as (() => void) | undefined;
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
