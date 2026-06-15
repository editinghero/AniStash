import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { validateSession } from "../../src/lib/auth";

type Bindings = {
  DB: D1Database;
};

// Helper to hash string to a unique integer
function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export const libraryRouter = new Hono<{ Bindings: Bindings }>()
  .get("/", async (c) => {
    const userId = await validateSession(c.env.DB, c.req.raw);
    if (!userId) return c.json([]);

    const db = c.env.DB;
    const { results } = await db
      .prepare(
        `
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
      `,
      )
      .bind(userId)
      .all<any>();

    const mapped = results.map((row) => ({
      ...row,
      anilistId: row.anilistId < 0 ? undefined : row.anilistId,
      genres: row.genresJson ? JSON.parse(row.genresJson) : [],
    }));
    return c.json(mapped);
  })
  .post(
    "/upsert",
    zValidator(
      "json",
      z.object({
        id: z.string().optional(),
        type: z.enum(["ANIME", "MANGA", "SERIES"]),
        status: z.enum([
          "WATCHING",
          "COMPLETED",
          "PLANNING",
          "ON_HOLD",
          "DROPPED",
        ]),
        anilistId: z.number().int().optional(),
        malId: z.number().int().optional(),
        title: z.string().min(1),
        englishTitle: z.string().optional().nullable(),
        nativeTitle: z.string().optional().nullable(),
        coverImage: z.string().optional().nullable(),
        bannerImage: z.string().optional().nullable(),
        genres: z.array(z.string()).optional().nullable(),
        format: z.string().optional().nullable(),
        episodes: z.number().int().optional().nullable(),
        chapters: z.number().int().optional().nullable(),
        averageScore: z.number().optional().nullable(),
        ageRating: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        sourceUrl: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        progress: z.number().int().optional().nullable(),
        userScore: z.number().optional().nullable(),
        startedAt: z.number().optional().nullable(),
        finishedAt: z.number().optional().nullable(),
      }),
    ),
    async (c) => {
      const data = c.req.valid("json");
      const userId = await validateSession(c.env.DB, c.req.raw);
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const db = c.env.DB;
      const now = Date.now();
      const finalAnilistId =
        data.anilistId ?? -1 * Math.abs(hashStringToInt(data.title));

      const mediaRow = await db
        .prepare(
          `
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
      `,
        )
        .bind(
          finalAnilistId,
          data.malId ?? null,
          data.type === "SERIES" ? "ANIME" : data.type,
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
          0,
          data.ageRating ?? null,
          data.description ?? null,
          now,
          now,
        )
        .first<{ id: number }>();

      if (!mediaRow)
        return c.json({ error: "Failed to insert media metadata" }, 500);

      const finalId = data.id ?? crypto.randomUUID();

      const userMedia = await db
        .prepare(
          `
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
      `,
        )
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

      if (!userMedia)
        return c.json({ error: "Failed to save user media list entry" }, 500);

      return c.json({
        ...data,
        id: userMedia.id,
        createdAt: userMedia.created_at,
        updatedAt: userMedia.updated_at,
      });
    },
  )
  .post(
    "/update",
    zValidator(
      "json",
      z.object({
        id: z.string(),
        status: z
          .enum(["WATCHING", "COMPLETED", "PLANNING", "ON_HOLD", "DROPPED"])
          .optional(),
        progress: z.number().int().optional(),
        userScore: z.number().optional(),
        notes: z.string().optional(),
        startedAt: z.number().optional(),
        finishedAt: z.number().optional(),
      }),
    ),
    async (c) => {
      const data = c.req.valid("json");
      const userId = await validateSession(c.env.DB, c.req.raw);
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const db = c.env.DB;
      await db
        .prepare(
          `
        UPDATE user_media SET
          status = COALESCE(?, status),
          progress = COALESCE(?, progress),
          user_score = COALESCE(?, user_score),
          notes = COALESCE(?, notes),
          started_at = COALESCE(?, started_at),
          finished_at = COALESCE(?, finished_at),
          updated_at = ?
        WHERE id = ? AND user_id = ?
      `,
        )
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

      return c.json({ success: true });
    },
  )
  .post(
    "/delete",
    zValidator(
      "json",
      z.object({
        id: z.string(),
      }),
    ),
    async (c) => {
      const data = c.req.valid("json");
      const userId = await validateSession(c.env.DB, c.req.raw);
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const db = c.env.DB;
      await db
        .prepare("DELETE FROM user_media WHERE id = ? AND user_id = ?")
        .bind(data.id, userId)
        .run();

      return c.json({ success: true });
    },
  );
