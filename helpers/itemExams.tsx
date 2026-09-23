export const MAX_ITEM_EXAMS = 5;

export type ItemExam = { examId: number | null; examName: string };

const uniqueNames = (names: readonly unknown[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = typeof raw === "string" ? raw.trim() : "";
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
};

/** Trimmed, de-duplicated (case-insensitive) and capped at the max, order kept. */
export const normalizeExamNames = (
  names: readonly string[] | null | undefined,
  max: number = MAX_ITEM_EXAMS
): string[] => uniqueNames(names ?? []).slice(0, max);

/** An item's exam names, primary first. Reads `exams` when the payload carries
 * it and falls back to the single `examName` for payloads that predate it. */
export const getItemExamNames = (item: unknown): string[] => {
  if (!item || typeof item !== "object") return [];
  const { exams, examName } = item as { exams?: unknown; examName?: unknown };
  if (Array.isArray(exams) && exams.length > 0) {
    return uniqueNames(
      exams.map((exam) =>
        typeof exam === "string"
          ? exam
          : exam && typeof exam === "object"
            ? (exam as { examName?: unknown }).examName
            : null
      )
    );
  }
  return uniqueNames([examName]);
};

/** Adds an AI-suggested exam: the whole list when empty, otherwise prepended as
 * the new primary. Skipped when already present, at the max, or (given the
 * official list) not an official exam; official matches use the canonical name. */
export const addSuggestedExam = (
  current: readonly string[],
  suggested: string | null | undefined,
  officialExams?: readonly { name: string }[],
  max: number = MAX_ITEM_EXAMS
): string[] => {
  let name = suggested?.trim() ?? "";
  if (!name) return [...current];
  if (officialExams && officialExams.length > 0) {
    const match = officialExams.find((exam) => exam.name.toLowerCase() === name.toLowerCase());
    if (!match) return [...current];
    name = match.name;
  }
  const key = name.toLowerCase();
  if (current.some((existing) => existing.toLowerCase() === key)) return [...current];
  if (current.length >= max) return [...current];
  return [name, ...current];
};

/** "SSC CGL +2" style label plus the full list for a title attribute. */
export const summarizeExamNames = (names: readonly string[]) => ({
  primary: names[0] ?? null,
  extraCount: Math.max(0, names.length - 1),
  label: names.length === 0 ? "" : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`,
  fullList: names.join(", "),
});