import type { LibraryEntry, ListStatus, MediaType } from "../types";

/* ============================================================
 * LOCAL STORAGE LIBRARY REPO (Archived — no backend)
 * ============================================================ */

const STORAGE_KEY = "anistash:library";

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

function loadFromStorage(): LibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LibraryEntry[];
  } catch {}
  return [];
}

function saveToStorage(entries: LibraryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
  window.dispatchEvent(new CustomEvent("otaku:library-changed"));
}

let cache: LibraryEntry[] = loadFromStorage();
let loaded = true;

export async function refreshLibrary() {
  cache = loadFromStorage();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("otaku:library-changed"));
  }
}

export function listEntries(type?: MediaType): LibraryEntry[] {
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
  const finalEntry = {
    ...entry,
    id: entry.id ?? (existingIdx >= 0 ? cache[existingIdx].id : createId()),
    createdAt: existingIdx >= 0 ? cache[existingIdx].createdAt : Date.now(),
    updatedAt: Date.now(),
  } as LibraryEntry;

  if (existingIdx >= 0) cache[existingIdx] = finalEntry;
  else cache.push(finalEntry);
  loaded = true;
  saveToStorage(cache);
  return finalEntry;
}

export function updateEntry(id: string, patch: Partial<LibraryEntry>) {
  const idx = cache.findIndex((e) => e.id === id);
  if (idx >= 0) {
    cache[idx] = { ...cache[idx], ...patch, updatedAt: Date.now() };
    saveToStorage(cache);
  }
}

export function setStatus(id: string, status: ListStatus) {
  updateEntry(id, { status });
}

export function deleteEntry(id: string) {
  cache = cache.filter((e) => e.id !== id);
  saveToStorage(cache);
}

export const removeEntry = deleteEntry;

export function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("otaku:library-changed", handler);
  return () => {
    window.removeEventListener("otaku:library-changed", handler);
  };
}
