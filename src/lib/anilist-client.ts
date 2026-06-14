/**
 * Browser-side AniList + Gemini client.
 *
 * Why client-side: AniList aggressively blocks Cloudflare Worker IP ranges
 * with a manual 403 ("principal's office"). Calling from the user's browser
 * uses their own IP and works reliably. Gemini also accepts CORS from
 * browsers when the API key is provided as a query param.
 */

export interface AnilistMedia {
  id: number;
  idMal: number | null;
  type: "ANIME" | "MANGA";
  format: string | null;
  status: string | null;
  episodes: number | null;
  chapters: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number | null;
  isAdult: boolean;
  genres: string[];
  description: string | null;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { large: string | null; extraLarge: string | null; color: string | null };
  bannerImage: string | null;
  startDate: { year: number | null } | null;
  season: string | null;
}

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

async function anilist<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
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

export async function searchAnilist(
  query: string,
  type: "ANIME" | "MANGA",
  perPage = 8,
): Promise<AnilistMedia[]> {
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
    q: query,
    type,
    perPage,
  });
  return out.Page.media;
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

/** Best-effort URL→title hint when a page can't be CORS-fetched. */
function guessTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    return decodeURIComponent(seg)
      .replace(/[-_]+/g, " ")
      .replace(/\.(html?|php)$/i, "")
      .replace(/\b(episode|ep|chapter|ch|season)\s*\d+\b/gi, "")
      .trim();
  } catch {
    return "";
  }
}

export interface ParseBookmarkResult {
  title: string;
  type: "ANIME" | "MANGA";
  confidence: "high" | "medium" | "low";
  notes: string;
  candidates: AnilistMedia[];
}

export async function parseBookmark(opts: {
  url: string;
  hintType?: "ANIME" | "MANGA";
  geminiApiKey: string;
  geminiModel: string;
}): Promise<ParseBookmarkResult> {
  const { url, hintType, geminiApiKey, geminiModel } = opts;
  const urlHint = guessTitleFromUrl(url);

  const sys = `You extract a clean anime or manga title from a bookmark URL and any provided URL slug hint.
Return ONLY JSON of shape:
{"title": string, "type": "ANIME"|"MANGA", "confidence": "high"|"medium"|"low", "notes": string}

Rules:
- Strip site names, "Watch", "Read", "Online", "Free", "in HD", episode numbers, "Chapter X", season suffixes when not part of the canonical title.
- Keep the original franchise name. Don't translate.
- Default type to ANIME if uncertain unless the URL clearly says manga, chapter, or read.
- "notes" is one short sentence explaining anything ambiguous.`;

  const user = `URL: ${url}
URL slug hint: ${urlHint || "(none)"}
Hint type: ${hintType ?? "none"}`;

  const raw = await callGemini(geminiApiKey, geminiModel, sys, user);

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

  const title = (parsed.title || urlHint || "").trim();
  const type = parsed.type === "MANGA" ? "MANGA" : hintType ?? "ANIME";

  if (!title) {
    return {
      title: "",
      type,
      confidence: "low",
      notes: parsed.notes || "Could not extract a title from this URL.",
      candidates: [],
    };
  }

  let candidates: AnilistMedia[] = [];
  try {
    candidates = await searchAnilist(title, type, 6);
  } catch {
    candidates = [];
  }

  return {
    title,
    type,
    confidence: (parsed.confidence as "high" | "medium" | "low") || "medium",
    notes: parsed.notes || "",
    candidates,
  };
}