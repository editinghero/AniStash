import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/library-page";

export const Route = createFileRoute("/anime")({
  head: () => ({
    meta: [
      { title: "Anime — AniStash" },
      {
        name: "description",
        content:
          "Your anime list: watching, completed, plan to watch, on hold, and dropped.",
      },
      { property: "og:title", content: "Anime — AniStash" },
      {
        property: "og:description",
        content: "Track everything you're watching in one place.",
      },
    ],
  }),
  component: () => (
    <LibraryPage
      type="ANIME"
      title="Anime"
      intro="Everything you're watching, planning, or have finished."
    />
  ),
});
