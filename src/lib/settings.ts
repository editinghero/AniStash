import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDB, getEnvVar } from "./db";
import { validateSession } from "./auth";
import { encryptApiKey, decryptApiKey } from "./crypto";

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export interface AppSettings {
  geminiApiKey?: string;
  geminiModel?: string;
}

export const fetchSettingsServer = createServerFn({ method: "GET" })
  .handler(async ({ request }) => {
    const userId = await validateSession(request);
    if (!userId) return {};

    const db = await getDB();
    const row = await db
      .prepare("SELECT gemini_api_key, gemini_model FROM user_settings WHERE user_id = ?")
      .bind(userId)
      .first<{ gemini_api_key: string | null; gemini_model: string | null }>();

    if (!row) return {};

    let maskedKey = "";
    if (row.gemini_api_key) {
      try {
        const encryptionKey = (await getEnvVar("ENCRYPTION_KEY")) ?? "fallback-encryption-key-for-local-dev-123";
        const decrypted = await decryptApiKey(row.gemini_api_key, encryptionKey);
        maskedKey = decrypted.length > 4 ? `••••••••${decrypted.slice(-4)}` : decrypted;
      } catch (err) {
        console.error("Failed to decrypt Gemini API key", err);
        maskedKey = "••••••••error";
      }
    }

    return {
      geminiApiKey: maskedKey || undefined,
      geminiModel: row.gemini_model || DEFAULT_GEMINI_MODEL,
    };
  });

export const saveSettingsServer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      geminiApiKey: z.string().optional(),
      geminiModel: z.string().min(1),
    }),
  )
  .handler(async ({ data, request }) => {
    const userId = await validateSession(request);
    if (!userId) throw new Error("Unauthorized");

    const db = await getDB();
    const now = Date.now();
    const encryptionKey = (await getEnvVar("ENCRYPTION_KEY")) ?? "fallback-encryption-key-for-local-dev-123";

    const existing = await db
      .prepare("SELECT gemini_api_key FROM user_settings WHERE user_id = ?")
      .bind(userId)
      .first<{ gemini_api_key: string | null }>();

    let finalEncryptedKey: string | null = null;
    if (data.geminiApiKey) {
      if (data.geminiApiKey.startsWith("••••")) {
        finalEncryptedKey = existing?.gemini_api_key ?? null;
      } else {
        finalEncryptedKey = await encryptApiKey(data.geminiApiKey, encryptionKey);
      }
    }

    if (existing) {
      await db
        .prepare(`
          UPDATE user_settings SET
            gemini_api_key = ?,
            gemini_model = ?,
            updated_at = ?
          WHERE user_id = ?
        `)
        .bind(finalEncryptedKey, data.geminiModel, now, userId)
        .run();
    } else {
      await db
        .prepare(`
          INSERT INTO user_settings (user_id, gemini_api_key, gemini_model, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(userId, finalEncryptedKey, data.geminiModel, now, now)
        .run();
    }

    return { success: true };
  });