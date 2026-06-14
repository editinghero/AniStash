import { useEffect, useState } from "react";
import { listEntries, subscribe } from "./repo/library";
import type { MediaType } from "./types";

export function useLibrary(type?: MediaType) {
  const [entries, setEntries] = useState(() => listEntries(type));
  useEffect(() => {
    const refresh = () => setEntries(listEntries(type));
    refresh();
    return subscribe(refresh);
  }, [type]);
  return entries;
}
