import { db } from "./db";

export interface ResolvedExam {
  examId: number | null;
  examName: string | null;
}

/**
 * Resolves an exam name by performing a case-insensitive search against
 * the exams table. If a match is found on examName or fullName, the
 * canonical examId and examName are returned. Otherwise, examId is null
 * and the trimmed input is returned as examName.
 *
 * If the input is undefined, the resolved values are left as null.
 * If the input is null or an empty string, both fields are cleared to null.
 */
export async function resolveExamByName(
  examNameInput?: string | null
): Promise<ResolvedExam> {
  // Not provided in the request — leave fields untouched (caller decides)
  if (examNameInput === undefined) {
    return { examId: null, examName: null };
  }

  const trimmed = examNameInput?.trim();

  // Explicitly cleared (null or empty string)
  if (!trimmed) {
    return { examId: null, examName: null };
  }

  // Case-insensitive match against examName or fullName
  const exam = await db
    .selectFrom("exams")
    .select(["id", "examName"])
    .where((eb) =>
      eb.or([
        eb("exams.examName", "ilike", trimmed),
        eb("exams.fullName", "ilike", trimmed),
      ])
    )
    .executeTakeFirst();

  if (exam) {
    return { examId: exam.id, examName: exam.examName };
  }

  return { examId: null, examName: trimmed };
}