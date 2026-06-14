import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/library-page";

export const Route = createFileRoute("/series")({
  head: () => ({
    meta: [
      { title: "Series — AniStash" },
      {
        name: "description",
        content:
          "Track custom series, web shows, and dramas — fully manual entries with your own notes.",
      },
      { property: "og:title", content: "Series — AniStash" },
      {
        property: "og:description",
        content: "Your custom watchlist for any show outside anime and manga.",
      },
    ],
  }),
  component: () => (
    <LibraryPage
      type="SERIES"
      title="Series"
      intro="Custom entries — any show, web series, or drama. Fully manual, no auto-fetch."
    />
  ),
});