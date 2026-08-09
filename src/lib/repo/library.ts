import type { LibraryEntry, ListStatus, MediaType } from "../types";

/* ============================================================
 * CLIENT-SIDE API WRAPPERS (Call-Compatible with existing code)
 * ============================================================ */

import { rpc } from "../rpc";

let cache: LibraryEntry[] = [];
let loaded = false;

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

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

export async function refreshLibrary() {
  await refresh();
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
  const existingIdx =
    entry.anilistId != null
      ? cache.findIndex(
          (cached) =>
            cached.type === entry.type && cached.anilistId === entry.anilistId,
        )
      : -1;
  const previousEntry = existingIdx >= 0 ? cache[existingIdx] : undefined;
  const optimisticEntry = {
    ...entry,
    id: entry.id ?? (existingIdx >= 0 ? cache[existingIdx].id : createId()),
    createdAt: existingIdx >= 0 ? cache[existingIdx].createdAt : Date.now(),
    updatedAt: Date.now(),
  } as LibraryEntry;

  if (existingIdx >= 0) cache[existingIdx] = optimisticEntry;
  else cache.push(optimisticEntry);
  loaded = true;
  window.dispatchEvent(new CustomEvent("otaku:library-changed"));

  void rpc.api.library.upsert
    .$post({ json: optimisticEntry as any })
    .then(async (res) => {
      if (res.ok) {
        const row = (await res.json()) as unknown as LibraryEntry;
        const idx = cache.findIndex(
          (e) => e.id === row.id || e.id === optimisticEntry.id,
        );
        if (idx >= 0) cache[idx] = row;
        else cache.push(row);
        cache = cache.filter(
          (e, index) =>
            index === cache.findIndex((candidate) => candidate.id === e.id),
        );
        window.dispatchEvent(new CustomEvent("otaku:library-changed"));
      }
    })
    .catch((err) => {
      console.error("Failed to upsert entry on D1", err);
      if (previousEntry) {
        const idx = cache.findIndex((e) => e.id === optimisticEntry.id);
        if (idx >= 0) cache[idx] = previousEntry;
      } else {
        cache = cache.filter((e) => e.id !== optimisticEntry.id);
      }
      window.dispatchEvent(new CustomEvent("otaku:library-changed"));
    });
  return optimisticEntry;
}

export function updateEntry(id: string, patch: Partial<LibraryEntry>) {
  const idx = cache.findIndex((e) => e.id === id);
  const previousEntry = idx >= 0 ? cache[idx] : undefined;
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
        sourceUrl: patch.sourceUrl,
        startedAt: patch.startedAt,
        finishedAt: patch.finishedAt,
        categories: patch.categories,
      },
    })
    .then((res) => {
      if (!res.ok) throw new Error("Failed to update entry");
    })
    .catch((err) => {
      console.error("Failed to update entry on D1", err);
      if (previousEntry) {
        const restoreIdx = cache.findIndex((e) => e.id === id);
        if (restoreIdx >= 0) {
          cache[restoreIdx] = previousEntry;
          window.dispatchEvent(new CustomEvent("otaku:library-changed"));
        }
      }
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
