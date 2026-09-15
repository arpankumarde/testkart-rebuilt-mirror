// Tiny client-safe HTML→plain-text helper for building AI prompt context from
// rich text editor values (question text, options, etc.). Not meant to be a
// full sanitizer — just enough to hand a legible string to an LLM prompt.
export const stripHtmlClient = (html: string | null | undefined): string =>
  (html ?? "").replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
