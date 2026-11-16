import { db } from "./db";

export type BankContent = {
  questionText?: string | null;
  questionType?: string | null;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  optionE?: string | null;
  correctOption?: string | null;
  correctOptions?: string[] | null;
  numericalAnswer?: number | string | null;
  numericalTolerance?: number | string | null;
  matchData?: unknown;
  paragraphText?: string | null;
};

function text(v: unknown): string | null {
  return v === null || v === undefined || v === "" ? null : String(v);
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = stable((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

function matchKey(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  let parsed = v;
  if (typeof v === "string") {
    try {
      parsed = JSON.parse(v);
    } catch {
      return v;
    }
  }
  return JSON.stringify(stable(parsed));
}

// The question's content. Marks, explanation, subject, tags and source are not
// part of it, so the same question reached from two tests is still one question.
export function bankQuestionKey(q: BankContent): string {
  return JSON.stringify([
    text(q.questionText),
    text(q.questionType),
    text(q.optionA),
    text(q.optionB),
    text(q.optionC),
    text(q.optionD),
    text(q.optionE),
    text(q.correctOption),
    q.correctOptions ? [...q.correctOptions].map(String).sort() : null,
    num(q.numericalAnswer),
    num(q.numericalTolerance),
    matchKey(q.matchData),
    text(q.paragraphText),
  ]);
}

// A teacher's bank holds each question once. Returns only the rows that are not
// already in this teacher's bank and not repeated inside the batch itself.
// Call it outside any db.transaction(): the pool has one connection.
export async function dropQuestionsAlreadyInBank<T extends BankContent>(
  teacherId: number,
  rows: T[]
): Promise<{ fresh: T[]; skipped: number }> {
  if (rows.length === 0) return { fresh: [], skipped: 0 };

  const texts = Array.from(
    new Set(rows.map((r) => r.questionText).filter((t): t is string => !!t))
  );
  const seen = new Set<string>();

  for (let i = 0; i < texts.length; i += 200) {
    const existing = await db
      .selectFrom("questionBank")
      .select([
        "questionText",
        "questionType",
        "optionA",
        "optionB",
        "optionC",
        "optionD",
        "optionE",
        "correctOption",
        "correctOptions",
        "numericalAnswer",
        "numericalTolerance",
        "matchData",
        "paragraphText",
      ])
      .where("teacherId", "=", teacherId)
      .where("questionText", "in", texts.slice(i, i + 200))
      .execute();
    for (const e of existing) seen.add(bankQuestionKey(e as BankContent));
  }

  const fresh: T[] = [];
  for (const r of rows) {
    const key = bankQuestionKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(r);
  }
  return { fresh, skipped: rows.length - fresh.length };
}
