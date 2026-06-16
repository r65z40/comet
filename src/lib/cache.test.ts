import { describe, it, expect, beforeEach } from "vitest";
import { cacheGet, cacheSet, cacheInvalidate, cacheClear } from "./cache";

describe("cache", () => {
  beforeEach(() => {
    cacheClear();
  });

  it("returns null for missing keys", () => {
    expect(cacheGet("nonexistent")).toBeNull();
  });

  it("stores and retrieves values", () => {
    cacheSet("key1", { data: 42 }, 60_000);
    expect(cacheGet("key1")).toEqual({ data: 42 });
  });

  it("expires entries after TTL", async () => {
    cacheSet("short", "value", 1);
    await new Promise((r) => setTimeout(r, 10));
    expect(cacheGet("short")).toBeNull();
  });

  it("invalidates by prefix", () => {
    cacheSet("settings:smtp", "a", 60_000);
    cacheSet("settings:notif", "b", 60_000);
    cacheSet("other:key", "c", 60_000);

    cacheInvalidate("settings:");

    expect(cacheGet("settings:smtp")).toBeNull();
    expect(cacheGet("settings:notif")).toBeNull();
    expect(cacheGet("other:key")).toBe("c");
  });

  it("clears all entries", () => {
    cacheSet("a", 1, 60_000);
    cacheSet("b", 2, 60_000);
    cacheClear();
    expect(cacheGet("a")).toBeNull();
    expect(cacheGet("b")).toBeNull();
  });

  it("overwrites existing keys", () => {
    cacheSet("key", "old", 60_000);
    cacheSet("key", "new", 60_000);
    expect(cacheGet("key")).toBe("new");
  });
});
