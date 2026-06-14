/**
 * Cloudflare D1 adapter — DROP-IN REPLACEMENT for `library.ts`.
 *
 * How to wire this up (when you self-host on Cloudflare):
 *
 * 1. Create a D1 database:
 *      wrangler d1 create anistash
 *
 * 2. Add a binding to your `wrangler.toml`:
 *      [[d1_databases]]
 *      binding = "DB"
 *      database_name = "anistash"
 *      database_id = "<id from step 1>"
 *
 * 3. Apply the schema:
 *      wrangler d1 execute anistash --file=./schema.d1.sql --remote
 *
 * 4. Expose the `env.DB` binding inside server routes/functions
 *    (the current TanStack Start template needs a small bridge — read
 *    `getRequest()` then access the bound platform context).
 *
 * 5. Implement the server route `app/routes/api/library.ts` below, then
 *    rename THIS file to `library.ts` (overwriting the localStorage version).
 *    The exports are call-compatible — the rest of the app keeps working.
 *
 * The reference server route is at the bottom of this file (commented out).
 */

import type { LibraryEntry, ListStatus, MediaType } from "../types";

const API = "/api/library";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`D1 ${res.status}`);
  return res.json() as Promise<T>;
}

let cache: LibraryEntry[] = [];
let loaded = false;

async function refresh() {
  cache = await api<LibraryEntry[]>("");
  loaded = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("otaku:library-changed"));
  }
}

export function listEntries(type?: MediaType): LibraryEntry[] {
  if (!loaded && typeof window !== "undefined") void refresh();
  const sorted = [...cache].sort((a, b) => b.updatedAt - a.updatedAt);
  return type ? sorted.filter((e) => e.type === type) : sorted;
}

export function getEntry(id: string): LibraryEntry | undefined {
  return cache.find((e) => e.id === id);
}

export function upsertEntry(
  entry: Omit<LibraryEntry, "id" | "createdAt" | "updatedAt"> & { id?: string },
): LibraryEntry {
  // optimistic — server returns canonical row
  void api<LibraryEntry>("", { method: "POST", body: JSON.stringify(entry) }).then((row) => {
    const idx = cache.findIndex((e) => e.id === row.id);
    if (idx >= 0) cache[idx] = row;
    else cache.push(row);
    window.dispatchEvent(new CustomEvent("otaku:library-changed"));
  });
  return { ...entry, id: entry.id ?? crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() } as LibraryEntry;
}

export function updateEntry(id: string, patch: Partial<LibraryEntry>) {
  const idx = cache.findIndex((e) => e.id === id);
  if (idx >= 0) cache[idx] = { ...cache[idx], ...patch, updatedAt: Date.now() };
  void api(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) }).then(refresh);
}

export function setStatus(id: string, status: ListStatus) {
  updateEntry(id, { status });
}

export function deleteEntry(id: string) {
  cache = cache.filter((e) => e.id !== id);
  void api(`/${id}`, { method: "DELETE" }).then(refresh);
}

export function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  if (!loaded) void refresh();
  const handler = () => cb();
  window.addEventListener("otaku:library-changed", handler);
  return () => window.removeEventListener("otaku:library-changed", handler);
}

/* ============================================================
 * REFERENCE SERVER ROUTE — create at `src/routes/api/library.ts`
 * ============================================================
 *
 * import { createFileRoute } from "@tanstack/react-router";
 *
 * type Env = { DB: D1Database };
 * function db(req: Request): D1Database {
 *   // @ts-expect-error — Cloudflare attaches `cf` env via the worker
 *   return (req as any).cf?.env?.DB as D1Database;
 * }
 *
 * export const Route = createFileRoute("/api/library")({
 *   server: {
 *     handlers: {
 *       GET: async ({ request }) => {
 *         const userId = await getUserId(request); // your auth
 *         const { results } = await db(request)
 *           .prepare(`
 *             SELECT um.*, m.* FROM user_media um
 *             JOIN media m ON m.id = um.media_id
 *             WHERE um.user_id = ?
 *             ORDER BY um.updated_at DESC
 *           `)
 *           .bind(userId)
 *           .all();
 *         return Response.json(results.map(rowToEntry));
 *       },
 *       POST: async ({ request }) => {
 *         const body = await request.json();
 *         // 1. upsert into `media` keyed on (anilist_id, type)
 *         // 2. upsert into `user_media` keyed on (user_id, media_id)
 *         // 3. return the merged row
 *       },
 *     },
 *   },
 * });
 */