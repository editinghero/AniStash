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

function getSystemDateContext(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Current Date & Time: ${dateStr} (ISO: ${now.toISOString()}). Always use this real current date context when answering queries about recent events, releases, schedules, and past news.`;
}

export const aiRouter = new Hono<{ Bindings: Bindings }>()
  .post(
    "/global-chat",
    zValidator(
      "json",
      z.object({
        message: z.string().min(1),
        allowSpoilers: z.boolean().optional().default(false),
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
          `SELECT m.title_romaji, m.title_english, m.type, m.format, m.episodes, m.chapters, 
                  um.status, um.progress, um.user_score, um.notes
           FROM user_media um
           JOIN media m ON um.media_id = m.id
           WHERE um.user_id = ?`,
        )
        .bind(userId)
        .all();

      const libraryContext = JSON.stringify(libraryRows.results);
      const spoilerInstruction = data.allowSpoilers
        ? "The user has ALLOWED spoilers. You may freely discuss plot twists, endings, character fates, and manga/light novel developments if relevant."
        : "CRITICAL: The user has SPOILER PROTECTION TURNED ON. You MUST NOT reveal major plot twists, character deaths, identity reveals, ending revelations, or future events unless explicitly asked. Keep summaries and descriptions strictly spoiler-free.";

      const systemInstruction = `You are a helpful, knowledgeable AI assistant for AniStash, an anime, manga, and series tracking application.
${getSystemDateContext()}
Here is the user's complete library including their personal notes, progress, ratings, and status:
${libraryContext}
${spoilerInstruction}

Use this library data to answer questions about what the user has watched, read, or noted. If the user asks about their notes or thoughts on any title, reference the 'notes' field for that title. If they ask for recommendations, suggest items that are NOT in their library.

You have active Google Search grounding tools; use them actively to search the web and provide current, up-to-date information for recent events, releases, chapter/episode updates, news, or general real-time queries. Keep responses concise and use markdown formatting.`;

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
    "/deep-dive",
    zValidator(
      "json",
      z.object({
        mode: z.enum([
          "direct-chat",
          "where-was-i",
          "plot-summary",
          "similar-titles",
          "latest-news",
          "custom",
        ]),
        seriesTitle: z.string().optional(),
        seasonNum: z.string().optional(),
        episodeNum: z.string().optional(),
        message: z.string().optional(),
        allowSpoilers: z.boolean().default(false),
        includeNotes: z.boolean().default(false),
        userNotes: z.string().optional(),
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

      const title = data.seriesTitle?.trim() || "";
      const spoilerRule = data.allowSpoilers
        ? "The user has permitted spoilers. You may discuss full plot developments, reveals, and resolutions."
        : "CRITICAL: The user has strictly ENABLED spoiler protection. Under NO circumstances reveal any future plot twists, character deaths, or secret reveals. Keep your answer strictly within safe boundaries.";

      let promptText = "";
      let userDisplayMessage = "";

      if (data.mode === "where-was-i") {
        const ep = data.episodeNum?.trim() || "1";
        const season = data.seasonNum?.trim() ? `Season ${data.seasonNum}` : "";
        const targetPoint = season ? `${season} Episode ${ep}` : `Episode/Chapter ${ep}`;
        userDisplayMessage = `Where was I in "${title}" up to ${targetPoint}?`;
        
        let notesContext = "";
        if (data.includeNotes && data.userNotes?.trim()) {
          notesContext = `\nUser's Personal Notes & Impressions:\n"${data.userNotes.trim()}"\nUse these notes to reference what the user noted, but the recap must strictly NOT exceed ${targetPoint}.`;
        }

        promptText = `I stopped watching/reading "${title}" at ${targetPoint}. 
Please provide a clear, engaging recap of the story and key character developments strictly up to ${targetPoint}.
RULES:
1. DO NOT spoil anything that happens after ${targetPoint}. Absolutely no future revelations, deaths, or twists.
2. Clearly summarize the main events leading up to and including ${targetPoint} so I can jump back into the series seamlessly.${notesContext}
3. Use Google Search grounding to verify the exact episode/chapter events accurately.`;
      } else if (data.mode === "plot-summary") {
        userDisplayMessage = `Give me a spoiler-free plot summary for "${title}".`;
        promptText = `Provide an enticing, high-quality, and completely spoiler-free plot overview for "${title}".
Explain the premise, main setting, core conflict, and tone without spoiling major plot points or later surprises. Use Google Search grounding to ensure accurate character and universe details.`;
      } else if (data.mode === "similar-titles") {
        userDisplayMessage = `What are titles similar to "${title}"?`;
        promptText = `Recommend 4-5 anime or manga series that are similar to "${title}".
For each recommendation, include:
- Title
- Genre/Vibe
- Why it matches "${title}" (themes, pacing, art style, or character dynamics)
Keep each recommendation spoiler-free. Use Google Search grounding to find the most fitting and acclaimed recommendations.`;
      } else if (data.mode === "latest-news") {
        userDisplayMessage = `What is the latest news for "${title}"?`;
        promptText = `Search the web using Google Search grounding for the latest official news, updates, announcements, release dates, upcoming seasons/movies, or adaptation news regarding "${title}".
Provide a concise, bulleted summary of recent updates with approximate dates. If there are no recent updates in the last few months, state the current status of the franchise.`;
      } else {
        const customMsg = data.message?.trim() || (title ? `Tell me about "${title}"` : "Hello!");
        userDisplayMessage = title ? `[Regarding "${title}"]: ${customMsg}` : customMsg;
        let notesContext = "";
        if (data.includeNotes && data.userNotes?.trim()) {
          notesContext = `\nUser's Personal Notes on this title: "${data.userNotes.trim()}".`;
        }
        promptText = title ? `Regarding the title "${title}":\n${customMsg}${notesContext}` : customMsg;
      }

      // Fetch user's entire library context so deep-dive also knows all user notes & stash items
      const libraryRows = await db
        .prepare(
          `SELECT m.title_romaji, m.title_english, m.type, um.status, um.progress, um.user_score, um.notes
           FROM user_media um
           JOIN media m ON um.media_id = m.id
           WHERE um.user_id = ?`,
        )
        .bind(userId)
        .all();

      const libraryContext = JSON.stringify(libraryRows.results);

      const systemInstruction = `You are a knowledgeable anime and manga expert AI in AniStash.
${getSystemDateContext()}
${spoilerRule}
User Stash & Notes Context: ${libraryContext}
You have active Google Search grounding tools; use them actively to search the web for the latest, most accurate facts, episode breakdowns, release news, and recaps.
Format your responses in markdown.`;

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
          message: promptText,
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

        history.push({ role: "user", text: userDisplayMessage });
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
    "/briefing",
    zValidator(
      "json",
      z.object({
        type: z.enum(["ANIME", "MANGA"]).default("ANIME"),
        season: z.string().optional(),
        year: z.number().optional(),
        genre: z.string().optional(),
        titles: z.array(z.string()).min(1),
      }),
    ),
    async (c) => {
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
      let apiKey = "";
      try {
        apiKey = await decryptApiKey(settings.gemini_api_key, encryptionKey);
      } catch (e) {
        return c.json({ error: "Failed to decrypt API key." }, 500);
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = settings.gemini_model || "gemini-2.5-flash";

      const titleList = data.titles.slice(0, 20).join(", ");
      const contextLabel = data.season
        ? `${data.season} ${data.year ?? ""} Anime Season`
        : `${data.genre ?? "Popular"} ${data.type}`;

      const prompt = `Write a stylish, spoiler-free briefing for this curated list of titles from the ${contextLabel}.
Highlight standout premises, anticipated studio work/animation highlights, themes, and what kind of viewers will enjoy each standout show. Do not include plot twists or spoilers.
Titles: ${titleList}`;

      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            systemInstruction: `You are an anime industry analyst providing spoiler-free seasonal and genre briefings. ${getSystemDateContext()} Use Google Search grounding to verify release hype, studios, and accurate premises.`,
            tools: [{ googleSearch: {} }],
          },
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

        return c.json({ text: aiText, thought: aiThought });
      } catch (e: any) {
        return c.json({ error: e.message || "Failed to generate briefing." }, 500);
      }
    },
  )
  .post(
    "/news-digest",
    zValidator(
      "json",
      z.object({
        topic: z.string().optional(),
        customShows: z.array(z.string()).optional(),
        allowSpoilers: z.boolean().default(false),
      }),
    ),
    async (c) => {
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
      let apiKey = "";
      try {
        apiKey = await decryptApiKey(settings.gemini_api_key, encryptionKey);
      } catch (e) {
        return c.json({ error: "Failed to decrypt API key." }, 500);
      }

      const ai = new GoogleGenAI({ apiKey });
      const model = settings.gemini_model || "gemini-2.5-flash";

      let prompt = "";
      if (data.customShows && data.customShows.length > 0) {
        prompt = `Search the web using Google Search grounding and generate a concise markdown anime news digest of verified news from the last 14-30 days specifically for these shows: ${data.customShows
          .slice(0, 15)
          .join(", ")}. Group by show title with bullet points. Include dates and announcements.`;
      } else if (data.topic?.trim()) {
        prompt = `Search the web using Google Search grounding for verified news, developments, announcements, release dates, and updates from the past 1 to 4 weeks regarding "${data.topic.trim()}".
Provide a clear chronological or bulleted summary with dates. If no news occurred in the last month, state the latest known official status.`;
      } else {
        prompt = `Search the web using Google Search grounding and provide a comprehensive weekly anime industry digest summarizing the biggest news, season announcements, trailer drops, and manga updates from the past 7-14 days. Include dates.`;
      }

      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            systemInstruction: `You are an anime news journalist. ${getSystemDateContext()} Use Google Search grounding to deliver accurate, real-time news with markdown formatting.`,
            tools: [{ googleSearch: {} }],
          },
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

        return c.json({ text: aiText, thought: aiThought });
      } catch (e: any) {
        return c.json({ error: e.message || "Failed to generate news digest." }, 500);
      }
    },
  )
  .post(
    "/card-chat/:id",
    zValidator(
      "json",
      z.object({
        message: z.string().min(1),
        allowSpoilers: z.boolean().optional().default(false),
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
          `SELECT um.ai_chat_history, um.status, um.progress, um.user_score, um.notes, 
                  m.title_romaji, m.title_english, m.description, m.genres_json, m.average_score, m.type, m.format
           FROM user_media um
           JOIN media m ON um.media_id = m.id
           WHERE um.id = ? AND um.user_id = ?`,
        )
        .bind(entryId, userId)
        .first<any>();

      if (!entry) return c.json({ error: "Entry not found" }, 404);

      const spoilerRule = data.allowSpoilers
        ? "The user has allowed spoilers for this title."
        : "Spoiler protection is ON. Do not reveal unprompted future twists or deaths.";

      const systemInstruction = `You are an AI assistant in AniStash. The user is asking about a specific item in their library.
${getSystemDateContext()}
Title: ${entry.title_english || entry.title_romaji}
Type: ${entry.type} (${entry.format})
Description: ${entry.description}
Genres: ${entry.genres_json}
Average Score: ${entry.average_score}
User Status: ${entry.status}
User Progress: ${entry.progress}
User Score: ${entry.user_score}
User Notes: ${entry.notes}
${spoilerRule}

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
      const globalRow = await db
        .prepare(
          "SELECT global_chat_history FROM user_settings WHERE user_id = ?",
        )
        .bind(userId)
        .first<{ global_chat_history: string | null }>();

      const cardRows = await db
        .prepare(
          `SELECT um.id, um.ai_chat_history, m.title_romaji, m.title_english
           FROM user_media um
           JOIN media m ON um.media_id = m.id
           WHERE um.user_id = ? AND um.ai_chat_history IS NOT NULL AND um.ai_chat_history != '[]'`,
        )
        .bind(userId)
        .all<any>();

      const cardChats = (cardRows.results || []).map((r) => ({
        id: r.id,
        title: r.title_english || r.title_romaji,
        history: r.ai_chat_history ? JSON.parse(r.ai_chat_history) : [],
      }));

      return c.json({
        history: globalRow?.global_chat_history
          ? JSON.parse(globalRow.global_chat_history)
          : [],
        cardChats,
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
