import { db } from "./db";
import { sql } from "kysely";
import type { QuestionType } from "./schema";

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export async function syncToQuestionBank(
  teacherId: number,
  questions: Array<{
    questionText: string;
    questionType: string;
    optionA?: string | null;
    optionB?: string | null;
    optionC?: string | null;
    optionD?: string | null;
    optionE?: string | null;
    correctOption?: string | null;
    correctOptions?: string[] | null;
    numericalAnswer?: number | string | null;
    numericalTolerance?: number | string | null;
    positiveMarks?: number | string | null;
    negativeMarks?: number | string | null;
    partialMarking?: boolean | null;
    matchData?: any;
    paragraphText?: string | null;
    explanation?: string | null;
    durationSeconds?: number | null;
    subjectName?: string | null;
  }>,
  options?: { sourceMockTestId?: number; sourceTestItemId?: number; sourceTestQuestionIds?: number[] }
): Promise<void> {
  if (!questions || questions.length === 0) {
    return;
  }

  try {
    const values = questions.map((q, index) => ({
      teacherId,
      questionText: q.questionText,
      questionType: q.questionType as QuestionType,
      optionA: q.optionA ?? null,
      optionB: q.optionB ?? null,
      optionC: q.optionC ?? null,
      optionD: q.optionD ?? null,
      optionE: q.optionE ?? null,
      correctOption: q.correctOption ?? null,
      correctOptions: q.correctOptions ?? null,
      numericalAnswer: q.numericalAnswer ?? null,
      numericalTolerance: q.numericalTolerance ?? null,
      positiveMarks: q.positiveMarks ?? null,
      negativeMarks: q.negativeMarks ?? null,
      partialMarking: q.partialMarking ?? null,
      matchData: q.matchData ? JSON.stringify(q.matchData) : null,
      paragraphText: q.paragraphText ?? null,
      explanation: q.explanation ?? null,
      durationSeconds: q.durationSeconds ?? null,
      subjectName: q.subjectName ? toTitleCase(q.subjectName) : null,
      sourceMockTestId: options?.sourceMockTestId ?? null,
      sourceTestItemId: options?.sourceTestItemId ?? null,
      sourceTestQuestionId: options?.sourceTestQuestionIds?.[index] ?? null,
    }));

    // Perform individual inserts/upserts
    for (const value of values) {
      try {
        if (value.sourceTestQuestionId != null) {
          // Upsert against the partial unique index idx_question_bank_source_test_question.
          // The conflict target and its WHERE predicate are separate clauses —
          // folding the predicate into the target expression emits
          // ON CONFLICT ((col) WHERE ...) which Postgres rejects with
          // 'syntax error at or near "WHERE"'. That error was swallowed by the
          // catch below, so this branch failed silently from 2026-07-16 until
          // it was caught on 2026-09-02: no question created through the
          // manual or AI paths reached the question bank in that window.
          await db
            .insertInto("questionBank")
            .values(value)
            .onConflict((oc) =>
              oc.column("sourceTestQuestionId").where("sourceTestQuestionId", "is not", null).doUpdateSet({
                questionText: value.questionText,
                questionType: value.questionType,
                sourceMockTestId: value.sourceMockTestId,
                sourceTestItemId: value.sourceTestItemId,
                optionA: value.optionA,
                optionB: value.optionB,
                optionC: value.optionC,
                optionD: value.optionD,
                optionE: value.optionE,
                correctOption: value.correctOption,
                correctOptions: value.correctOptions as any,
                numericalAnswer: value.numericalAnswer,
                numericalTolerance: value.numericalTolerance,
                positiveMarks: value.positiveMarks,
                negativeMarks: value.negativeMarks,
                partialMarking: value.partialMarking,
                matchData: value.matchData,
                paragraphText: value.paragraphText,
                explanation: value.explanation,
                durationSeconds: value.durationSeconds,
                subjectName: value.subjectName,
                updatedAt: sql`now()`,
              })
            )
            .execute();
        } else {
          // Standard insert without conflict handling for manual additions
          await db
            .insertInto("questionBank")
            .values(value)
            .execute();
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(
          "[syncToQuestionBank] Failed to sync individual question to question bank:",
          errorMsg
        );
      }
    }
  } catch (error) {
    // Fire-and-forget: catch and log the outer error so we do not block the test creation flow
    console.error(
      "[syncToQuestionBank] Error during sync process:",
      error instanceof Error ? error.message : String(error)
    );
  }
}