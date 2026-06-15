import { LibraryPage } from "@/components/library-page";
import { useDocumentMetadata } from "@/lib/router";

export function MangaPage() {
  useDocumentMetadata(
    "Manga — AniStash",
    "Your manga list: reading, completed, plan to read, on hold, and dropped.",
  );

  return (
    <LibraryPage
      type="MANGA"
      title="Manga"
      intro="Everything you're reading, planning, or have finished."
    />
  );
}
