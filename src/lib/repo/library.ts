import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB } from "../db";
import { validateSession } from "../auth";
import type { LibraryEntry, ListStatus, MediaType } from "../types";

// Helper to hash string to a unique integer (used for manual series AniList ID placeholder)
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

/* ============================================================
 * SERVER-SIDE FUNCTIONS (D1 Queries)
 * ============================================================ */

export const fetchEntriesServer = createServerFn({ method: "GET" })
  .handler(async ({ request }) => {
    const userId = await validateSession(request);
    if (!userId) return [];

    const db = await getDB();
    const { results } = await db
      .prepare(`
        SELECT 
          um.id,
          m.type,
          um.status,
          m.anilist_id as anilistId,
          m.mal_id as malId,
          m.title_romaji as title,
          m.title_english as englishTitle,
          m.title_native as nativeTitle,
          m.cover_image as coverImage,
          m.banner_image as bannerImage,
          m.genres_json as genresJson,
          m.format,
          m.episodes,
          m.chapters,
          m.average_score as averageScore,
          m.age_rating as ageRating,
          m.description,
          um.source_url as sourceUrl,
          um.notes,
          um.progress,
          um.user_score as userScore,
          um.started_at as startedAt,
          um.finished_at as finishedAt,
          um.created_at as createdAt,
          um.updated_at as updatedAt
        FROM user_media um
        JOIN media m ON m.id = um.media_id
        WHERE um.user_id = ?
        ORDER BY um.updated_at DESC
      `)
      .bind(userId)
      .all<any>();

    return results.map((row) => ({
      ...row,
      anilistId: row.anilistId < 0 ? undefined : row.anilistId, // hide negative placeholders
      genres: row.genresJson ? JSON.parse(row.genresJson) : [],
    })) as LibraryEntry[];
  });

export const upsertEntryServer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string().optional(),
      type: z.enum(["ANIME", "MANGA", "SERIES"]),
      status: z.enum(["WATCHING", "COMPLETED", "PLANNING", "ON_HOLD", "DROPPED"]),
      anilistId: z.number().int().optional(),
      malId: z.number().int().optional(),
      title: z.string().min(1),
      englishTitle: z.string().optional(),
      nativeTitle: z.string().optional(),
      coverImage: z.string().optional(),
      bannerImage: z.string().optional(),
      genres: z.array(z.string()).optional(),
      format: z.string().optional(),
      episodes: z.number().int().optional(),
      chapters: z.number().int().optional(),
      averageScore: z.number().optional(),
      ageRating: z.string().optional(),
      description: z.string().optional(),
      sourceUrl: z.string().optional(),
      notes: z.string().optional(),
      progress: z.number().int().optional(),
      userScore: z.number().optional(),
      startedAt: z.number().optional(),
      finishedAt: z.number().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await validateSession(request);
    if (!userId) throw new Error("Unauthorized");

    const db = await getDB();
    const now = Date.now();
    
    // For manual series, use a unique negative placeholder id
    const finalAnilistId = data.anilistId ?? (-1 * Math.abs(hashStringToInt(data.title)));

    // 1. Insert/Update media row
    const mediaRow = await db
      .prepare(`
        INSERT INTO media (
          anilist_id, mal_id, type, format, title_romaji, title_english, title_native,
          cover_image, banner_image, genres_json, episodes, chapters, average_score,
          is_adult, age_rating, description, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(anilist_id, type) DO UPDATE SET
          mal_id=excluded.mal_id,
          format=excluded.format,
          title_romaji=excluded.title_romaji,
          title_english=excluded.title_english,
          title_native=excluded.title_native,
          cover_image=excluded.cover_image,
          banner_image=excluded.banner_image,
          genres_json=excluded.genres_json,
          episodes=excluded.episodes,
          chapters=excluded.chapters,
          average_score=excluded.average_score,
          is_adult=excluded.is_adult,
          age_rating=excluded.age_rating,
          description=excluded.description,
          updated_at=excluded.updated_at
        RETURNING id
      `)
      .bind(
        finalAnilistId,
        data.malId ?? null,
        data.type === "SERIES" ? "ANIME" : data.type, // Map SERIES to ANIME inside SQL check constraint if needed, or keep. D1 table constraint: CHECK(type IN ('ANIME','MANGA')). Let's map SERIES -> ANIME in media, but type is USER_MEDIA type
        data.format ?? null,
        data.title,
        data.englishTitle ?? null,
        data.nativeTitle ?? null,
        data.coverImage ?? null,
        data.bannerImage ?? null,
        data.genres ? JSON.stringify(data.genres) : null,
        data.episodes ?? null,
        data.chapters ?? null,
        data.averageScore ?? null,
        0, // is_adult
        data.ageRating ?? null,
        data.description ?? null,
        now,
        now,
      )
      .first<{ id: number }>();

    if (!mediaRow) throw new Error("Failed to insert media metadata");

    const finalId = data.id ?? crypto.randomUUID();

    // 2. Insert/Update user_media row
    const userMedia = await db
      .prepare(`
        INSERT INTO user_media (
          id, user_id, media_id, status, progress, user_score, notes, source_url,
          started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, media_id) DO UPDATE SET
          status=excluded.status,
          progress=excluded.progress,
          user_score=excluded.user_score,
          notes=excluded.notes,
          source_url=excluded.source_url,
          started_at=excluded.started_at,
          finished_at=excluded.finished_at,
          updated_at=excluded.updated_at
        RETURNING id, created_at, updated_at
      `)
      .bind(
        finalId,
        userId,
        mediaRow.id,
        data.status,
        data.progress ?? 0,
        data.userScore ?? null,
        data.notes ?? null,
        data.sourceUrl ?? null,
        data.startedAt ?? null,
        data.finishedAt ?? null,
        now,
        now,
      )
      .first<{ id: string; created_at: number; updated_at: number }>();

    if (!userMedia) throw new Error("Failed to save user media list entry");

    return {
      ...data,
      id: userMedia.id,
      createdAt: userMedia.created_at,
      updatedAt: userMedia.updated_at,
    } as LibraryEntry;
  });

export const updateEntryServer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      status: z.enum(["WATCHING", "COMPLETED", "PLANNING", "ON_HOLD", "DROPPED"]).optional(),
      progress: z.number().int().optional(),
      userScore: z.number().optional(),
      notes: z.string().optional(),
      startedAt: z.number().optional(),
      finishedAt: z.number().optional(),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await validateSession(request);
    if (!userId) throw new Error("Unauthorized");

    const db = await getDB();
    await db
      .prepare(`
        UPDATE user_media SET
          status = COALESCE(?, status),
          progress = COALESCE(?, progress),
          user_score = COALESCE(?, user_score),
          notes = COALESCE(?, notes),
          started_at = COALESCE(?, started_at),
          finished_at = COALESCE(?, finished_at),
          updated_at = ?
        WHERE id = ? AND user_id = ?
      `)
      .bind(
        data.status ?? null,
        data.progress !== undefined ? data.progress : null,
        data.userScore !== undefined ? data.userScore : null,
        data.notes !== undefined ? data.notes : null,
        data.startedAt !== undefined ? data.startedAt : null,
        data.finishedAt !== undefined ? data.finishedAt : null,
        Date.now(),
        data.id,
        userId,
      )
      .run();

    return { success: true };
  });

export const deleteEntryServer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, request }) => {
    const userId = await validateSession(request);
    if (!userId) throw new Error("Unauthorized");

    const db = await getDB();
    await db
      .prepare("DELETE FROM user_media WHERE id = ? AND user_id = ?")
      .bind(data.id, userId)
      .run();

    return { success: true };
  });

/* ============================================================
 * CLIENT-SIDE API WRAPPERS (Call-Compatible with existing code)
 * ============================================================ */

let cache: LibraryEntry[] = [];
let loaded = false;

async function refresh() {
  try {
    cache = await fetchEntriesServer();
    loaded = true;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("otaku:library-changed"));
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
  // Manual series are saved in DB media with type 'ANIME', but identified by type === "SERIES" inside user_media
  return type ? sorted.filter((e) => e.type === type) : sorted;
}

export function getEntry(id: string): LibraryEntry | undefined {
  return cache.find((e) => e.id === id);
}

export function upsertEntry(
  entry: Omit<LibraryEntry, "id" | "createdAt" | "updatedAt"> & { id?: string },
): LibraryEntry {
  void upsertEntryServer({ data: entry }).then((row) => {
    const idx = cache.findIndex((e) => e.id === row.id);
    if (idx >= 0) cache[idx] = row;
    else cache.push(row);
    window.dispatchEvent(new CustomEvent("otaku:library-changed"));
  }).catch((err) => {
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
  void updateEntryServer({
    data: {
      id,
      status: patch.status,
      progress: patch.progress,
      userScore: patch.userScore,
      notes: patch.notes,
      startedAt: patch.startedAt,
      finishedAt: patch.finishedAt,
    },
  }).then(refresh).catch((err) => {
    console.error("Failed to update entry on D1", err);
  });
}

export function setStatus(id: string, status: ListStatus) {
  updateEntry(id, { status });
}

export function deleteEntry(id: string) {
  cache = cache.filter((e) => e.id !== id);
  window.dispatchEvent(new CustomEvent("otaku:library-changed"));
  void deleteEntryServer({ data: { id } }).then(refresh).catch((err) => {
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
