import { LibraryPage } from "@/components/library-page";
import { useDocumentMetadata } from "@/lib/router";

export function SeriesPage() {
  useDocumentMetadata(
    "Series — AniStash",
    "Track custom series, web shows, and dramas — fully manual entries with your own notes.",
  );

  return (
    <LibraryPage
      type="SERIES"
      title="Series"
      intro="Custom entries — any show, web series, or drama. Fully manual, no auto-fetch."
    />
  );
}
