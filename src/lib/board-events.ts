export type BoardEventType =
  | "card:create"
  | "card:update"
  | "card:delete"
  | "card:move"
  | "card:archive"
  | "column:create"
  | "column:update"
  | "column:delete"
  | "comment:create"
  | "comment:delete"
  | "checklist:update"
  | "attachment:update"
  | "tag:update";

export interface BoardEvent {
  type: BoardEventType;
  cardId?: string;
  columnId?: string;
  userId?: string;
  ts: number;
}

type Listener = (event: BoardEvent) => void;

class BoardEventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  emit(event: Omit<BoardEvent, "ts">) {
    const full: BoardEvent = { ...event, ts: Date.now() };
    for (const fn of this.listeners) {
      try {
        fn(full);
      } catch {}
    }
  }
}

// Singleton — survives hot-reload in dev via globalThis
const g = globalThis as unknown as { __boardEventBus?: BoardEventBus };
if (!g.__boardEventBus) g.__boardEventBus = new BoardEventBus();

export const boardEvents = g.__boardEventBus;
