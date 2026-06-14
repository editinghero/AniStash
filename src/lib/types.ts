export type MediaType = "ANIME" | "MANGA" | "SERIES";

export type ListStatus =
  | "WATCHING"
  | "COMPLETED"
  | "PLANNING"
  | "ON_HOLD"
  | "DROPPED";

export const STATUS_LABEL: Record<ListStatus, string> = {
  WATCHING: "Watching",
  COMPLETED: "Completed",
  PLANNING: "Plan to Watch",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
};

export const STATUS_LABEL_MANGA: Record<ListStatus, string> = {
  WATCHING: "Reading",
  COMPLETED: "Completed",
  PLANNING: "Plan to Read",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
};

export const STATUS_LABEL_SERIES: Record<ListStatus, string> = {
  WATCHING: "Watching",
  COMPLETED: "Watched",
  PLANNING: "Plan to Watch",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
};

export function statusLabels(type: MediaType): Record<ListStatus, string> {
  if (type === "MANGA") return STATUS_LABEL_MANGA;
  if (type === "SERIES") return STATUS_LABEL_SERIES;
  return STATUS_LABEL;
}

export const ALL_STATUSES: ListStatus[] = [
  "WATCHING",
  "COMPLETED",
  "PLANNING",
  "ON_HOLD",
  "DROPPED",
];

export interface LibraryEntry {
  id: string; // local uuid
  type: MediaType;
  status: ListStatus;
  // metadata snapshot (cached from AniList for fast render)
  anilistId?: number;
  malId?: number;
  title: string;
  englishTitle?: string;
  nativeTitle?: string;
  coverImage?: string;
  bannerImage?: string;
  genres?: string[];
  format?: string;
  episodes?: number;
  chapters?: number;
  averageScore?: number; // AniList 0-100
  ageRating?: string; // best-effort from AniList isAdult / hints
  description?: string;
  sourceUrl?: string; // user's original bookmark
  notes?: string;
  progress?: number; // ep / chapter count
  userScore?: number; // 0-10
  startedAt?: number; // unix ms
  finishedAt?: number; // unix ms
  createdAt: number;
  updatedAt: number;
}
