import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { validateSession } from "../../src/lib/auth";
import { encryptApiKey, decryptApiKey } from "../../src/lib/crypto";

type Bindings = {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
};

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const settingsRouter = new Hono<{ Bindings: Bindings }>()
  .get("/", async (c) => {
    const userId = await validateSession(c.env.DB, c.req.raw);
    if (!userId) return c.json({});

    const db = c.env.DB;
    try {
      await db
        .prepare("ALTER TABLE user_settings ADD COLUMN categories_json TEXT")
        .run();
    } catch {}

    const row = await db
      .prepare(
        "SELECT gemini_api_key, gemini_model, categories_json FROM user_settings WHERE user_id = ?",
      )
      .bind(userId)
      .first<{
        gemini_api_key: string | null;
        gemini_model: string | null;
        categories_json: string | null;
      }>();

    if (!row) return c.json({});

    let maskedKey = "";
    if (row.gemini_api_key) {
      try {
        const encryptionKey =
          c.env.ENCRYPTION_KEY ?? "fallback-encryption-key-for-local-dev-123";
        const decrypted = await decryptApiKey(
          row.gemini_api_key,
          encryptionKey,
        );
        maskedKey =
          decrypted.length > 4 ? `••••••••${decrypted.slice(-4)}` : decrypted;
      } catch (err) {
        console.error("Failed to decrypt Gemini API key", err);
        maskedKey = "••••••••error";
      }
    }

    let categories: string[] | undefined = undefined;
    if (row.categories_json) {
      try {
        categories = JSON.parse(row.categories_json);
      } catch {}
    }

    return c.json({
      geminiApiKey: maskedKey || undefined,
      geminiModel: row.gemini_model || DEFAULT_GEMINI_MODEL,
      categories,
    });
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        geminiApiKey: z.string().optional(),
        geminiModel: z.string().min(1),
        categories: z.array(z.string()).optional(),
      }),
    ),
    async (c) => {
      const data = c.req.valid("json");
      const userId = await validateSession(c.env.DB, c.req.raw);
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const db = c.env.DB;
      try {
        await db
          .prepare("ALTER TABLE user_settings ADD COLUMN categories_json TEXT")
          .run();
      } catch {}

      const now = Date.now();
      const encryptionKey =
        c.env.ENCRYPTION_KEY ?? "fallback-encryption-key-for-local-dev-123";

      const existing = await db
        .prepare("SELECT gemini_api_key FROM user_settings WHERE user_id = ?")
        .bind(userId)
        .first<{ gemini_api_key: string | null }>();

      let finalEncryptedKey: string | null = null;
      if (data.geminiApiKey) {
        if (data.geminiApiKey.startsWith("••••")) {
          finalEncryptedKey = existing?.gemini_api_key ?? null;
        } else {
          finalEncryptedKey = await encryptApiKey(
            data.geminiApiKey,
            encryptionKey,
          );
        }
      }

      const categoriesJson = data.categories
        ? JSON.stringify(data.categories)
        : null;

      if (existing) {
        await db
          .prepare(
            `
          UPDATE user_settings SET
            gemini_api_key = ?,
            gemini_model = ?,
            categories_json = COALESCE(?, categories_json),
            updated_at = ?
          WHERE user_id = ?
        `,
          )
          .bind(
            finalEncryptedKey,
            data.geminiModel,
            categoriesJson,
            now,
            userId,
          )
          .run();
      } else {
        await db
          .prepare(
            `
          INSERT INTO user_settings (user_id, gemini_api_key, gemini_model, categories_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
          )
          .bind(
            userId,
            finalEncryptedKey,
            data.geminiModel,
            categoriesJson,
            now,
            now,
          )
          .run();
      }

      return c.json({ success: true });
    },
  );
