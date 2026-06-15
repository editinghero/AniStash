import type { LibraryEntry, ListStatus, MediaType } from "../types";

/* ============================================================
 * CLIENT-SIDE API WRAPPERS (Call-Compatible with existing code)
 * ============================================================ */

import { rpc } from "../rpc";

let cache: LibraryEntry[] = [];
let loaded = false;

async function refresh() {
  try {
    const res = await rpc.api.library.$get();
    if (res.ok) {
      cache = (await res.json()) as unknown as LibraryEntry[];
      loaded = true;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("otaku:library-changed"));
      }
    }
  } catch (err) {
    console.error("Failed to refresh library entries from D1", err);
  }
}

export function listEntries(type?: MediaType): LibraryEntry[] {
  if (!loaded && typeof window !== "undefined") {
    void refresh();
  }
  const sorted = [...cache].sort((a, b) => b.updatedAt - a.updatedAt);
  return type ? sorted.filter((e) => e.type === type) : sorted;
}

export function getEntry(id: string): LibraryEntry | undefined {
  return cache.find((e) => e.id === id);
}

export function upsertEntry(
  entry: Omit<LibraryEntry, "id" | "createdAt" | "updatedAt"> & { id?: string },
): LibraryEntry {
  void rpc.api.library.upsert
    .$post({ json: entry as any })
    .then(async (res) => {
      if (res.ok) {
        const row = (await res.json()) as unknown as LibraryEntry;
        const idx = cache.findIndex((e) => e.id === row.id);
        if (idx >= 0) cache[idx] = row;
        else cache.push(row);
        window.dispatchEvent(new CustomEvent("otaku:library-changed"));
      }
    })
    .catch((err) => {
      console.error("Failed to upsert entry on D1", err);
    });
  return {
    ...entry,
    id: entry.id ?? crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  } as LibraryEntry;
}

export function updateEntry(id: string, patch: Partial<LibraryEntry>) {
  const idx = cache.findIndex((e) => e.id === id);
  if (idx >= 0) {
    cache[idx] = { ...cache[idx], ...patch, updatedAt: Date.now() };
    window.dispatchEvent(new CustomEvent("otaku:library-changed"));
  }
  void rpc.api.library.update
    .$post({
      json: {
        id,
        status: patch.status,
        progress: patch.progress,
        userScore: patch.userScore,
        notes: patch.notes,
        startedAt: patch.startedAt,
        finishedAt: patch.finishedAt,
      },
    })
    .then(refresh)
    .catch((err) => {
      console.error("Failed to update entry on D1", err);
    });
}

export function setStatus(id: string, status: ListStatus) {
  updateEntry(id, { status });
}

export function deleteEntry(id: string) {
  cache = cache.filter((e) => e.id !== id);
  window.dispatchEvent(new CustomEvent("otaku:library-changed"));
  void rpc.api.library.delete
    .$post({ json: { id } })
    .then(refresh)
    .catch((err) => {
      console.error("Failed to delete entry on D1", err);
    });
}

export function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  if (!loaded) void refresh();
  const handler = () => cb();
  window.addEventListener("otaku:library-changed", handler);
  return () => {
    window.removeEventListener("otaku:library-changed", handler);
  };
}
