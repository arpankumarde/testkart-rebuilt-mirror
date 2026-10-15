/*
 * Languages of a test series, study note, course or live test (stored on its
 * test series). The `languages` column holds the
 * list; the older single `language` column keeps a readable summary of it
 * ("English, Hindi") for the shipped mobile app and any reader that has not
 * moved to the list. Writers send the list, and the endpoints store both.
 * A database trigger keeps the two in step for writers that set only one.
 */

export const LANGUAGE_OPTIONS = [
  "Assamese", "Bengali", "Bodo", "Dogri", "English", "Gujarati", "Hindi",
  "Kannada", "Kashmiri", "Konkani", "Maithili", "Malayalam", "Manipuri",
  "Marathi", "Multilingual", "Nepali", "Odia", "Punjabi", "Sanskrit",
  "Santali", "Sindhi", "Tamil", "Telugu", "Urdu",
] as const;

export const MAX_ITEM_LANGUAGES = 10;
export const MAX_LANGUAGE_LENGTH = 60;

/** Trimmed, blank entries dropped, duplicates removed case-insensitively, first spelling kept. */
export function normalizeLanguages(list: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of list ?? []) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

/** The text stored in the legacy `language` column for a list. */
export function languagesSummary(list: readonly string[]): string | null {
  const names = normalizeLanguages(list);
  return names.length > 0 ? names.join(", ") : null;
}

/** The list to show for an item, falling back to the legacy text for rows read without the list. */
export function itemLanguages(item: { languages?: readonly string[] | null; language?: string | null }): string[] {
  const list = normalizeLanguages(item.languages);
  if (list.length > 0) return list;
  const legacy = item.language?.trim();
  return legacy ? [legacy] : [];
}

export function formatLanguages(item: { languages?: readonly string[] | null; language?: string | null }): string {
  return itemLanguages(item).join(", ");
}
