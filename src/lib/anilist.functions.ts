import { rpc } from "./rpc";
import type { AnilistMedia } from "../../functions/api/anilist";

export type { AnilistMedia };

export async function searchAnilist(data: { query: string; type: "ANIME" | "MANGA"; perPage?: number }) {
  const res = await rpc.api.anilist.search.$post({ json: data });
  if (!res.ok) throw new Error("Failed to search anilist");
  return await res.json() as unknown as { results: AnilistMedia[] };
}

export async function getAnilistMedia(data: { id: number }) {
  const res = await rpc.api.anilist.get.$post({ json: data });
  if (!res.ok) throw new Error("Failed to fetch media");
  return await res.json() as unknown as { media: AnilistMedia };
}

export async function parseBookmark(data: { url: string; hintType?: "ANIME" | "MANGA" }) {
  const res = await rpc.api.anilist["parse-bookmark"].$post({ json: data });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok) {
    let errorMsg = "Failed to parse bookmark";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      errorMsg = (json as any).error || errorMsg;
    } else {
      const text = await res.text();
      errorMsg = text || errorMsg;
    }
    throw new Error(errorMsg);
  }
  return await res.json() as unknown as {
    title: string;
    type: "ANIME" | "MANGA";
    confidence: "high" | "medium" | "low";
    notes: string;
    candidates: AnilistMedia[];
  };
}
