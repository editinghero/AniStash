import { createFileRoute } from "@tanstack/react-router";
import { LibraryPage } from "@/components/library-page";

export const Route = createFileRoute("/manga")({
  head: () => ({
    meta: [
      { title: "Manga — AniStash" },
      {
        name: "description",
        content:
          "Your manga list: reading, completed, plan to read, on hold, and dropped.",
      },
      { property: "og:title", content: "Manga — AniStash" },
      {
        property: "og:description",
        content: "Track everything you're reading in one place.",
      },
    ],
  }),
  component: () => (
    <LibraryPage
      type="MANGA"
      title="Manga"
      intro="Everything you're reading, planning, or have finished."
    />
  ),
});
