import { LibraryPage } from "@/components/library-page";
import { useDocumentMetadata } from "@/lib/router";

export function AnimePage() {
  useDocumentMetadata(
    "Anime — AniStash",
    "Your anime list: watching, completed, plan to watch, on hold, and dropped.",
  );

  return (
    <LibraryPage
      type="ANIME"
      title="Anime"
      intro="Everything you're watching, planning, or have finished."
    />
  );
}
