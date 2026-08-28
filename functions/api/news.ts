import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { NEWS_SOURCES, getSourceById } from "../../src/lib/news-sources";
import type {
  NewsArticle,
  NewsFetchResponse,
} from "../../src/lib/news-sources";

function stripHtml(html: string): string {
  return html
    .replace(/<!\[CDATA\[(.*?)\]\]>/gis, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(xml: string, tagName: string): string {
  const cdataRe = new RegExp(
    `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`,
    "i",
  );
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch?.[1]) return cdataMatch[1].trim();

  const standardRe = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i",
  );
  const standardMatch = xml.match(standardRe);
  if (standardMatch?.[1]) return standardMatch[1].trim();

  return "";
}

function extractImageUrl(itemXml: string): string | undefined {
  const mediaContent = itemXml.match(
    /<media:content[^>]+url=["']([^"']+)["']/i,
  );
  if (mediaContent?.[1]) return mediaContent[1];

  const mediaThumbnail = itemXml.match(
    /<media:thumbnail[^>]+url=["']([^"']+)["']/i,
  );
  if (mediaThumbnail?.[1]) return mediaThumbnail[1];

  const enclosure = itemXml.match(
    /<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i,
  );
  if (enclosure?.[1]) return enclosure[1];

  const imgTag = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgTag?.[1]) return imgTag[1];

  return undefined;
}

function parseRssFeed(
  xml: string,
  sourceId: string,
  sourceName: string,
): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const itemMatches =
    xml.match(/<item[\s\S]*?<\/item>/gi) ||
    xml.match(/<entry[\s\S]*?<\/entry>/gi) ||
    [];

  for (let i = 0; i < itemMatches.length; i++) {
    const itemXml = itemMatches[i];
    const rawTitle = extractTag(itemXml, "title");
    const title = stripHtml(rawTitle);
    if (!title) continue;

    let link = extractTag(itemXml, "link");
    if (!link) {
      const linkAttr = itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (linkAttr?.[1]) link = linkAttr[1];
    }
    link = stripHtml(link);

    const pubDate =
      extractTag(itemXml, "pubDate") ||
      extractTag(itemXml, "published") ||
      extractTag(itemXml, "updated") ||
      extractTag(itemXml, "dc:date");
    const descriptionRaw =
      extractTag(itemXml, "description") ||
      extractTag(itemXml, "summary") ||
      extractTag(itemXml, "content");
    const description = stripHtml(descriptionRaw);
    const imageUrl = extractImageUrl(itemXml);
    const category = stripHtml(extractTag(itemXml, "category"));

    const id = `${sourceId}-${i}-${Math.abs(
      title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0),
    )}`;

    articles.push({
      id,
      sourceId,
      sourceName,
      title,
      url: link,
      publishedAt: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString(),
      description: description ? description.slice(0, 240) : undefined,
      imageUrl,
      category: category ? category.slice(0, 30) : undefined,
    });
  }

  return articles;
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  const out: NewsArticle[] = [];

  for (const article of articles) {
    const cleanTitle = article.title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (seen.has(cleanTitle)) continue;
    seen.add(cleanTitle);
    out.push(article);
  }

  return out;
}

export const newsRouter = new Hono().post(
  "/feed",
  zValidator(
    "json",
    z.object({
      sourceIds: z.array(z.string()).optional(),
    }),
  ),
  async (c) => {
    const data = c.req.valid("json");
    const requestedIds =
      data.sourceIds && data.sourceIds.length > 0
        ? data.sourceIds
        : NEWS_SOURCES.filter((s) => s.defaultEnabled).map((s) => s.id);

    const sources = requestedIds
      .map((id) => getSourceById(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    const successfulSources: string[] = [];
    const failedSources: string[] = [];
    const allArticles: NewsArticle[] = [];

    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);

        try {
          const res = await fetch(source.url, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Accept:
                "application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*",
              "Cache-Control": "no-cache",
            },
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }

          const xml = await res.text();
          const parsed = parseRssFeed(xml, source.id, source.name);
          return { sourceId: source.id, articles: parsed };
        } catch (err) {
          clearTimeout(timeoutId);
          throw { sourceId: source.id, error: err };
        }
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        successfulSources.push(result.value.sourceId);
        allArticles.push(...result.value.articles);
      } else {
        const reason = result.reason as { sourceId?: string } | undefined;
        if (reason?.sourceId) {
          failedSources.push(reason.sourceId);
        }
      }
    }

    // Sort newest first
    allArticles.sort((a, b) => {
      const timeA = new Date(a.publishedAt).getTime() || 0;
      const timeB = new Date(b.publishedAt).getTime() || 0;
      return timeB - timeA;
    });

    const deduplicated = deduplicateArticles(allArticles);

    const response: NewsFetchResponse = {
      articles: deduplicated,
      successfulSources,
      failedSources,
    };

    return c.json(response);
  },
);
