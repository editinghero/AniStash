import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { validateSession } from '../../src/lib/auth';
import { decryptApiKey } from '../../src/lib/crypto';
import type { AnilistMedia } from '../../src/lib/anilist.functions';

type Bindings = {
  DB: D1Database;
  ENCRYPTION_KEY?: string;
};

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  idMal
  type
  format
  status
  episodes
  chapters
  averageScore
  meanScore
  popularity
  isAdult
  genres
  description(asHtml: false)
  title { romaji english native }
  coverImage { large extraLarge color }
  bannerImage
  startDate { year }
  season
`;

async function anilist<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "AniStash/1.0 (+https://anistash.app)",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AniList ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 250)}`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function fetchPageContext(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AniStash/1.0; +https://anistash.app)",
        Accept: "text/html,*/*",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    const pick = (re: RegExp) => html.match(re)?.[1]?.trim() ?? "";
    const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
    const og = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const ogDesc = pick(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    );
    const h1 = pick(/<h1[^>]*>([^<]{2,200})<\/h1>/i);
    return [title, og, h1, ogDesc].filter(Boolean).join(" | ").slice(0, 1000);
  } catch {
    return "";
  }
}

export const anilistRouter = new Hono<{ Bindings: Bindings }>()
  .post('/search', zValidator('json', z.object({
    query: z.string().min(1).max(200),
    type: z.enum(["ANIME", "MANGA"]),
    perPage: z.number().int().min(1).max(15).default(10),
  })), async (c) => {
    const data = c.req.valid('json');
    const gql = `
      query ($q: String, $type: MediaType, $perPage: Int) {
        Page(page: 1, perPage: $perPage) {
          media(search: $q, type: $type, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    const out = await anilist<{ Page: { media: AnilistMedia[] } }>(gql, {
      q: data.query,
      type: data.type,
      perPage: data.perPage,
    });
    return c.json({ results: out.Page.media });
  })
  .post('/get', zValidator('json', z.object({
    id: z.number().int().positive()
  })), async (c) => {
    const data = c.req.valid('json');
    const gql = `query ($id: Int) { Media(id: $id) { ${MEDIA_FIELDS} } }`;
    const out = await anilist<{ Media: AnilistMedia }>(gql, { id: data.id });
    return c.json({ media: out.Media });
  })
  .post('/parse-bookmark', zValidator('json', z.object({
    url: z.string().url().max(2048),
    hintType: z.enum(["ANIME", "MANGA"]).optional(),
  })), async (c) => {
    const data = c.req.valid('json');
    const userId = await validateSession(c.env.DB, c.req.raw);
    if (!userId) return c.json({ error: "Unauthorized" }, 401);

    const db = c.env.DB;
    const settings = await db
      .prepare("SELECT gemini_api_key, gemini_model FROM user_settings WHERE user_id = ?")
      .bind(userId)
      .first<{ gemini_api_key: string | null; gemini_model: string | null }>();

    if (!settings || !settings.gemini_api_key) {
      return c.json({ error: "Add your Gemini API key in Settings first." }, 400);
    }

    const encryptionKey = c.env.ENCRYPTION_KEY ?? "fallback-encryption-key-for-local-dev-123";
    const decryptedKey = await decryptApiKey(settings.gemini_api_key, encryptionKey);
    const geminiModel = settings.gemini_model || "gemini-2.5-flash";

    const pageContext = await fetchPageContext(data.url);

    const sys = `You extract a clean anime or manga title from a bookmark URL and (when available) the page's title/og:title text.
Return ONLY JSON of shape:
{"title": string, "type": "ANIME"|"MANGA", "confidence": "high"|"medium"|"low", "notes": string}

Rules:
- Strip site names ("Anikoto"), "Watch", "Read", "Online", "Free", "in HD", episode numbers, "Chapter X", season suffixes when not part of the canonical title.
- Keep the original franchise name. Don't translate.
- Default type to ANIME if uncertain unless the URL/title clearly says manga, chapter, or read.
- "notes" is one short sentence explaining anything ambiguous.`;

    const user = `URL: ${data.url}
Page text: ${pageContext || "(could not fetch)"}
Hint: ${data.hintType ?? "none"}`;

    const raw = await callGemini(decryptedKey, geminiModel, sys, user);

    let parsed: {
      title?: string;
      type?: "ANIME" | "MANGA";
      confidence?: string;
      notes?: string;
    } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const title = (parsed.title || "").trim();
    const type = parsed.type === "MANGA" ? "MANGA" : "ANIME";

    if (!title) {
      return c.json({
        title: "",
        type,
        confidence: "low" as const,
        notes: parsed.notes || "Could not extract a title from this URL.",
        candidates: [] as AnilistMedia[],
      });
    }

    const gql = `
      query ($q: String, $type: MediaType) {
        Page(page: 1, perPage: 6) {
          media(search: $q, type: $type, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
            ${MEDIA_FIELDS}
          }
        }
      }
    `;
    let candidates: AnilistMedia[] = [];
    try {
      const out = await anilist<{ Page: { media: AnilistMedia[] } }>(gql, {
        q: title,
        type,
      });
      candidates = out.Page.media;
    } catch {
      candidates = [];
    }

    return c.json({
      title,
      type,
      confidence: (parsed.confidence as "high" | "medium" | "low") || "medium",
      notes: parsed.notes || "",
      candidates,
    });
  });
