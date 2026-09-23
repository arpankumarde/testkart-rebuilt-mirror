import type { Kysely, Transaction } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import type { User } from "./User";
import { MAX_EXAM_FOCUS, type ExamFocusItem } from "./examFocusShared";

export { isExamFocusPromptDue } from "./examFocusShared";

type Executor = Kysely<DB> | Transaction<DB>;

export class ExamFocusError extends Error {}

export async function loadExamFocus(userId: number, executor: Executor = db): Promise<ExamFocusItem[]> {
  return executor
    .selectFrom("userExamFocus")
    .innerJoin("exams", "exams.id", "userExamFocus.examId")
    .select(["exams.id", "exams.examName", "exams.examSlug"])
    .where("userExamFocus.userId", "=", userId)
    .orderBy("userExamFocus.position", "asc")
    .orderBy("userExamFocus.id", "asc")
    .execute();
}

// Replaces the user's focus, keeping the given order. A teacher's names are also written to
// users.target_exams, which the admin teacher list, sales contacts and teacher cards still read.
export async function saveExamFocus(
  trx: Transaction<DB>,
  userId: number,
  role: User["role"],
  examIds: number[]
): Promise<ExamFocusItem[]> {
  const ids = [...new Set(examIds)];
  if (ids.length === 0 || ids.length > MAX_EXAM_FOCUS) {
    throw new ExamFocusError(`Choose between 1 and ${MAX_EXAM_FOCUS} exams.`);
  }

  const exams = await trx
    .selectFrom("exams")
    .select(["id", "examName", "examSlug"])
    .where("id", "in", ids)
    .execute();
  if (exams.length !== ids.length) {
    throw new ExamFocusError("One of the selected exams is no longer available. Please pick again.");
  }
  const byId = new Map(exams.map((exam) => [exam.id, exam]));
  const ordered = ids.map((id) => byId.get(id)!);

  await trx.deleteFrom("userExamFocus").where("userId", "=", userId).execute();
  await trx
    .insertInto("userExamFocus")
    .values(ids.map((examId, position) => ({ userId, examId, position })))
    .execute();

  if (role === "teacher") {
    await trx
      .updateTable("users")
      .set({ targetExams: ordered.map((exam) => exam.examName), updatedAt: new Date() })
      .where("id", "=", userId)
      .execute();
  }

  return ordered;
}