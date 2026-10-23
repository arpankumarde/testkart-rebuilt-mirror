type Searchable = { term: string; definition: string };

export type HighlightPart = { text: string; match: boolean };

/**
 * Words may be separated by a space or a hyphen, so "computer based" finds "Computer-based".
 * A single letter only matches the start of a word, or nearly every term would match and be marked.
 */
const patternFor = (query: string): string | null => {
  const words = query.trim().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return null;
  if (words.length === 1 && /^\w$/.test(words[0])) return `\\b${words[0]}`;
  return words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s-]+");
};

/** Term name matches come before definition matches, and earlier matches first. Keeps the given order otherwise. */
const find = <T extends Searchable>(terms: T[], query: string): T[] => {
  const pattern = patternFor(query);
  if (!pattern) return [];
  const anywhere = new RegExp(pattern, "i");
  const atStart = new RegExp(`^${pattern}`, "i");
  const atWord = new RegExp(`\\b${pattern}`, "i");
  const score = ({ term, definition }: T) => {
    if (atStart.test(term)) return 0;
    if (atWord.test(term)) return 1;
    if (anywhere.test(term)) return 2;
    return anywhere.test(definition) ? 3 : null;
  };
  return terms
    .map((term) => ({ term, rank: score(term) }))
    .filter((item): item is { term: T; rank: number } => item.rank !== null)
    .sort((a, b) => a.rank - b.rank)
    .map((item) => item.term);
};

const highlight = (text: string, query: string): HighlightPart[] => {
  const pattern = patternFor(query);
  if (!pattern) return [{ text, match: false }];
  return text
    .split(new RegExp(`(${pattern})`, "gi"))
    .map((part, index) => ({ text: part, match: index % 2 === 1 }))
    .filter((part) => part.text);
};

export const glossarySearch = { find, highlight };