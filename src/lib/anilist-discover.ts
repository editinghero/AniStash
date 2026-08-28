import type { AnilistMedia } from "./anilist-client";

export type MediaSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export const SEASONS: MediaSeason[] = ["WINTER", "SPRING", "SUMMER", "FALL"];

export const CATEGORIES = [
  "ALL",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "Adult (18+)",
] as const;

export const DISCOVER_SORTS = [
  { value: "POPULARITY_DESC", label: "Popular" },
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "SCORE_DESC", label: "Top Rated" },
  { value: "START_DATE_DESC", label: "Release Date" },
  { value: "TITLE_ROMAJI", label: "Title A–Z" },
] as const;

export type DiscoverSort = (typeof DISCOVER_SORTS)[number]["value"];

export function currentSeason(): { season: MediaSeason; year: number } {
  const date = new Date();
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (month >= 1 && month <= 3) return { season: "WINTER", year };
  if (month >= 4 && month <= 6) return { season: "SPRING", year };
  if (month >= 7 && month <= 9) return { season: "SUMMER", year };
  return { season: "FALL", year };
}

export function prevSeason(
  season: MediaSeason,
  year: number,
): { season: MediaSeason; year: number } {
  const idx = SEASONS.indexOf(season);
  if (idx === 0) {
    return { season: "FALL", year: year - 1 };
  }
  return { season: SEASONS[idx - 1], year };
}

export function nextSeason(
  season: MediaSeason,
  year: number,
): { season: MediaSeason; year: number } {
  const idx = SEASONS.indexOf(season);
  if (idx === 3) {
    return { season: "WINTER", year: year + 1 };
  }
  return { season: SEASONS[idx + 1], year };
}

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface StatusDistributionItem {
  status: string;
  amount: number;
}

export interface MediaRanking {
  id: number;
  rank: number;
  type: string;
  context: string;
  year?: number;
  season?: string;
  allTime?: boolean;
}

export interface DiscoverMediaItem extends AnilistMedia {
  rankings?: MediaRanking[];
  stats?: {
    statusDistribution?: StatusDistributionItem[];
  };
}

const DISCOVER_MEDIA_FIELDS = `
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
  rankings {
    id
    rank
    type
    context
    year
    season
    allTime
  }
  stats {
    statusDistribution {
      status
      amount
    }
  }
`;

export interface DiscoverResult {
  media: DiscoverMediaItem[];
  hasNextPage: boolean;
}

export async function fetchDiscoverMedia(params: {
  type: "ANIME" | "MANGA";
  season?: MediaSeason | null;
  seasonYear?: number | null;
  genre?: string | null;
  sort?: DiscoverSort;
  page?: number;
  perPage?: number;
}): Promise<DiscoverResult> {
  const {
    type,
    season,
    seasonYear,
    genre,
    sort = "POPULARITY_DESC",
    page = 1,
    perPage = 25,
  } = params;

  const isAdult = genre === "Adult (18+)";

  const gql = `
    query (
      $page: Int,
      $perPage: Int,
      $type: MediaType,
      $season: MediaSeason,
      $seasonYear: Int,
      $genre: String,
      $sort: [MediaSort],
      $isAdult: Boolean
    ) {
      Page(page: $page, perPage: $perPage) {
        pageInfo {
          hasNextPage
          currentPage
        }
        media(
          type: $type,
          season: $season,
          seasonYear: $seasonYear,
          genre: $genre,
          sort: $sort,
          isAdult: $isAdult
        ) {
          ${DISCOVER_MEDIA_FIELDS}
        }
      }
    }
  `;

  const variables: Record<string, unknown> = {
    page,
    perPage,
    type,
    sort: [sort],
    isAdult: isAdult ? true : false,
  };

  if (!isAdult && season && seasonYear) {
    variables.season = season;
    variables.seasonYear = seasonYear;
  }

  if (genre && genre !== "ALL" && !isAdult) {
    variables.genre = genre;
  }

  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: gql, variables }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AniList ${res.status}: ${errText.slice(0, 150)}`);
  }

  const data = (await res.json()) as {
    data?: {
      Page?: {
        pageInfo?: { hasNextPage?: boolean };
        media?: DiscoverMediaItem[];
      };
    };
    errors?: { message: string }[];
  };

  if (data.errors?.length) {
    throw new Error(data.errors[0].message);
  }

  return {
    media: data.data?.Page?.media || [],
    hasNextPage: Boolean(data.data?.Page?.pageInfo?.hasNextPage),
  };
}
