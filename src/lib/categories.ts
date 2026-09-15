export const DEFAULT_CATEGORIES: string[] = [
  "Rom",
  "Com",
  "Ecchi",
  "Fun",
  "Calm",
];

const STORAGE_KEY = "anistash:custom-categories";

function loadLocal(): string[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_CATEGORIES;
}

let categoriesCache: string[] = loadLocal();

function saveLocal(categories: string[]) {
  categoriesCache = categories;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
    } catch {}
    window.dispatchEvent(new CustomEvent("otaku:categories-changed"));
  }
}

export function getCategories(): string[] {
  return categoriesCache;
}

export function saveCategories(categories: string[]) {
  saveLocal(categories);
}

export function addCategory(categoryName: string): boolean {
  const trimmed = categoryName.trim();
  if (!trimmed) return false;

  const current = getCategories();
  const exists = current.some((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (exists) return false;

  const updated = [...current, trimmed];
  saveCategories(updated);
  return true;
}

export function deleteCategory(categoryName: string): boolean {
  const current = getCategories();
  const updated = current.filter(
    (c) => c.toLowerCase() !== categoryName.trim().toLowerCase(),
  );
  if (updated.length === current.length) return false;

  saveCategories(updated);
  return true;
}

export function subscribeCategories(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => cb();
  window.addEventListener("otaku:categories-changed", handler);
  return () => {
    window.removeEventListener("otaku:categories-changed", handler);
  };
}
