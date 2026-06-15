import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { validateSession } from "../../src/lib/auth";
import { decryptApiKey } from "../../src/lib/crypto";
import { GoogleGenAI } from "@google/genai";

type Bindings = {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
};

export const aiRouter = new Hono<{ Bindings: Bindings }>()
  .post(
    "/global-chat",
    zValidator(
      "json",
      z.object({
        message: z.string().min(1),
      }),
    ),
    async (c) => {
      const data = c.req.valid("json");
      const userId = await validateSession(c.env.DB, c.req.raw);
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const db = c.env.DB;
      const settings = await db
        .prepare(
          "SELECT gemini_api_key, gemini_model, global_chat_history FROM user_settings WHERE user_id = ?",
        )
        .bind(userId)
        .first<{
          gemini_api_key: string | null;
          gemini_model: string | null;
          global_chat_history: string | null;
        }>();

      if (!settings || !settings.gemini_api_key) {
        return c.json(
          { error: "Gemini API Key not configured in settings." },
          400,
        );
      }

      const encryptionKey =
        c.env.ENCRYPTION_KEY ?? "fallback-encryption-key-for-local-dev-123";
      let apiKey = "";
      try {
        apiKey = await decryptApiKey(settings.gemini_api_key, encryptionKey);
      } catch (e) {
        return c.json({ error: "Failed to decrypt API key." }, 500);
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = settings.gemini_model || "gemini-2.5-flash";

      const libraryRows = await db
        .prepare(
          `
      SELECT m.title_romaji, m.title_english, m.type, um.status, um.progress, um.user_score, um.notes
      FROM user_media um
      JOIN media m ON um.media_id = m.id
      WHERE um.user_id = ?
    `,
        )
        .bind(userId)
        .all();

      const libraryContext = JSON.stringify(libraryRows.results);

      const systemInstruction = `You are a helpful AI assistant for AniStash, an anime and manga tracking application. 
Here is the user's entire library in JSON format: ${libraryContext}.
Answer the user's questions based on this library. If they ask for recommendations, suggest items that are NOT in their library. 

You have access to Google Search grounding tools; use them actively to search the web and provide current, up-to-date information for recent events, releases, chapter/episode updates, news, or general real-time queries. Keep responses concise and use markdown formatting.`;

      let history: any[] = [];
      if (settings.global_chat_history) {
        try {
          history = JSON.parse(settings.global_chat_history);
        } catch (e) {
          history = [];
        }
      }

      try {
        const formattedHistory = history.map((msg) => {
          const parts: any[] = [];
          if (msg.thought) {
            parts.push({ thought: true, text: msg.thought });
          }
          parts.push({ text: msg.text });
          return {
            role: msg.role === "user" ? "user" : "model",
            parts: parts,
          };
        });

        const chatSession = ai.chats.create({
          model: model,
          config: {
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }],
          },
          history: formattedHistory,
        });

        const response = await chatSession.sendMessage({
          message: data.message,
        });

        let aiText = "";
        let aiThought = "";
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.thought) {
            aiThought += part.text || "";
          } else if (part.text) {
            aiText += part.text || "";
          }
        }
        if (!aiText) {
          aiText = response.text || "";
        }

        history.push({ role: "user", text: data.message });
        history.push({
          role: "model",
          text: aiText,
          thought: aiThought || undefined,
        });

        await db
          .prepare(
            "UPDATE user_settings SET global_chat_history = ? WHERE user_id = ?",
          )
          .bind(JSON.stringify(history), userId)
          .run();

        return c.json({ text: aiText, thought: aiThought, history });
      } catch (e: any) {
        return c.json(
          { error: e.message || "Failed to communicate with AI." },
          500,
        );
      }
    },
  )
  .post(
    "/card-chat/:id",
    zValidator(
      "json",
      z.object({
        message: z.string().min(1),
      }),
    ),
    async (c) => {
      const entryId = c.req.param("id");
      const data = c.req.valid("json");
      const userId = await validateSession(c.env.DB, c.req.raw);
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const db = c.env.DB;
      const settings = await db
        .prepare(
          "SELECT gemini_api_key, gemini_model FROM user_settings WHERE user_id = ?",
        )
        .bind(userId)
        .first<{
          gemini_api_key: string | null;
          gemini_model: string | null;
        }>();

      if (!settings || !settings.gemini_api_key) {
        return c.json(
          { error: "Gemini API Key not configured in settings." },
          400,
        );
      }

      const encryptionKey =
        c.env.ENCRYPTION_KEY ?? "fallback-encryption-key-for-local-dev-123";
      const apiKey = await decryptApiKey(
        settings.gemini_api_key,
        encryptionKey,
      );

      const entry = await db
        .prepare(
          `
      SELECT um.ai_chat_history, um.status, um.progress, um.user_score, um.notes, 
             m.title_romaji, m.title_english, m.description, m.genres_json, m.average_score, m.type, m.format
      FROM user_media um
      JOIN media m ON um.media_id = m.id
      WHERE um.id = ? AND um.user_id = ?
    `,
        )
        .bind(entryId, userId)
        .first<any>();

      if (!entry) return c.json({ error: "Entry not found" }, 404);

      const systemInstruction = `You are an AI assistant in AniStash. The user is asking about a specific item in their library.
Title: ${entry.title_english || entry.title_romaji}
Type: ${entry.type} (${entry.format})
Description: ${entry.description}
Genres: ${entry.genres_json}
Average Score: ${entry.average_score}
User Status: ${entry.status}
User Progress: ${entry.progress}
User Score: ${entry.user_score}
User Notes: ${entry.notes}

Answer questions about this specific title, help them remember details, or provide recommendations related to it.

You have access to Google Search grounding tools; use them actively to search the web and provide current, up-to-date information for recent events, releases, chapter/episode updates, news, or general real-time queries. Keep responses concise and use markdown formatting.`;

      const ai = new GoogleGenAI({ apiKey });
      const model = settings.gemini_model || "gemini-2.5-flash";

      let history: any[] = [];
      if (entry.ai_chat_history) {
        try {
          history = JSON.parse(entry.ai_chat_history);
        } catch (e) {
          history = [];
        }
      }

      try {
        const formattedHistory = history.map((msg) => {
          const parts: any[] = [];
          if (msg.thought) {
            parts.push({ thought: true, text: msg.thought });
          }
          parts.push({ text: msg.text });
          return {
            role: msg.role === "user" ? "user" : "model",
            parts: parts,
          };
        });

        const chatSession = ai.chats.create({
          model: model,
          config: {
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }],
          },
          history: formattedHistory,
        });

        const response = await chatSession.sendMessage({
          message: data.message,
        });

        let aiText = "";
        let aiThought = "";
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.thought) {
            aiThought += part.text || "";
          } else if (part.text) {
            aiText += part.text || "";
          }
        }
        if (!aiText) {
          aiText = response.text || "";
        }

        history.push({ role: "user", text: data.message });
        history.push({
          role: "model",
          text: aiText,
          thought: aiThought || undefined,
        });

        await db
          .prepare("UPDATE user_media SET ai_chat_history = ? WHERE id = ?")
          .bind(JSON.stringify(history), entryId)
          .run();

        return c.json({ text: aiText, thought: aiThought, history });
      } catch (e: any) {
        return c.json(
          { error: e.message || "Failed to communicate with AI." },
          500,
        );
      }
    },
  )
  .delete(
    "/clear-chat",
    zValidator(
      "json",
      z.object({
        type: z.enum(["global", "card"]),
        id: z.string().optional(),
      }),
    ),
    async (c) => {
      const data = c.req.valid("json");
      const userId = await validateSession(c.env.DB, c.req.raw);
      if (!userId) return c.json({ error: "Unauthorized" }, 401);

      const db = c.env.DB;
      if (data.type === "global") {
        await db
          .prepare(
            "UPDATE user_settings SET global_chat_history = NULL WHERE user_id = ?",
          )
          .bind(userId)
          .run();
      } else if (data.type === "card" && data.id) {
        await db
          .prepare(
            "UPDATE user_media SET ai_chat_history = NULL WHERE id = ? AND user_id = ?",
          )
          .bind(data.id, userId)
          .run();
      }
      return c.json({ success: true });
    },
  )
  .get("/history", async (c) => {
    const type = c.req.query("type");
    const id = c.req.query("id");
    const userId = await validateSession(c.env.DB, c.req.raw);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const db = c.env.DB;
    if (type === "global") {
      const row = await db
        .prepare(
          "SELECT global_chat_history FROM user_settings WHERE user_id = ?",
        )
        .bind(userId)
        .first<{ global_chat_history: string | null }>();
      return c.json({
        history: row?.global_chat_history
          ? JSON.parse(row.global_chat_history)
          : [],
      });
    } else if (type === "card" && id) {
      const row = await db
        .prepare(
          "SELECT ai_chat_history FROM user_media WHERE id = ? AND user_id = ?",
        )
        .bind(id, userId)
        .first<{ ai_chat_history: string | null }>();
      return c.json({
        history: row?.ai_chat_history ? JSON.parse(row.ai_chat_history) : [],
      });
    }
    return c.json({ history: [] });
  });
