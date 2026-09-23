import { sql, type RawBuilder } from "kysely";
import type { DbExecutor } from "./enrollmentCounters";

/**
 * The admin custom exam name tools rewrite custom (non-official) exam names on content. These apply the
 * same change to the *_exams join tables and then point each touched item's own exam_id / exam_name back
 * at its first remaining exam, so the row keeps mirroring its primary exam (see helpers/contentExams).
 * Run them inside the tool's transaction, after its base-row updates.
 */
const TARGETS = [
  { base: "mock_tests", join: "mock_test_exams", fk: "mock_test_id" },
  { base: "digital_products", join: "digital_product_exams", fk: "digital_product_id" },
  { base: "courses", join: "course_exams", fk: "course_id" },
] as const;

type Target = (typeof TARGETS)[number];
type ContentIdRow = { contentId: number };

async function resyncPrimaryExams(executor: DbExecutor, target: Target, contentIds: number[]) {
  const ids = [...new Set(contentIds)];
  if (ids.length === 0) return;
  const { base, join, fk } = target;
  await sql`UPDATE ${sql.table(base)} b SET exam_id = f.exam_id, exam_name = f.exam_name
    FROM (
      SELECT DISTINCT ON (${sql.ref(fk)}) ${sql.ref(fk)} AS content_id, exam_id, exam_name
      FROM ${sql.table(join)}
      WHERE ${sql.ref(fk)} IN (${sql.join(ids)})
      ORDER BY ${sql.ref(fk)}, position, id
    ) f
    WHERE b.id = f.content_id`.execute(executor);
  await sql`UPDATE ${sql.table(base)} b SET exam_id = NULL, exam_name = NULL
    WHERE b.id IN (${sql.join(ids)})
      AND NOT EXISTS (SELECT 1 FROM ${sql.table(join)} ce WHERE ce.${sql.ref(fk)} = b.id)`.execute(executor);
}

/** Renames a custom exam name. An item that already lists the new name just drops the old entry. */
export async function renameCustomExamOnContent(executor: DbExecutor, oldName: string, newName: string) {
  for (const target of TARGETS) {
    const { join, fk } = target;
    const dropped = await sql<ContentIdRow>`DELETE FROM ${sql.table(join)} c
      WHERE c.exam_id IS NULL AND c.exam_name = ${oldName}
        AND EXISTS (
          SELECT 1 FROM ${sql.table(join)} o
          WHERE o.${sql.ref(fk)} = c.${sql.ref(fk)} AND o.id <> c.id AND lower(o.exam_name) = lower(${newName})
        )
      RETURNING c.${sql.ref(fk)} AS "contentId"`.execute(executor);
    const renamed = await sql<ContentIdRow>`UPDATE ${sql.table(join)} SET exam_name = ${newName}
      WHERE exam_id IS NULL AND exam_name = ${oldName}
      RETURNING ${sql.ref(fk)} AS "contentId"`.execute(executor);
    await resyncPrimaryExams(
      executor,
      target,
      [...dropped.rows, ...renamed.rows].map((row) => row.contentId)
    );
  }
}

/** Removes a custom exam name from every item that lists it. */
export async function removeCustomExamFromContent(executor: DbExecutor, name: string) {
  for (const target of TARGETS) {
    const { join, fk } = target;
    const removed = await sql<ContentIdRow>`DELETE FROM ${sql.table(join)}
      WHERE exam_id IS NULL AND exam_name = ${name}
      RETURNING ${sql.ref(fk)} AS "contentId"`.execute(executor);
    await resyncPrimaryExams(executor, target, removed.rows.map((row) => row.contentId));
  }
}

/**
 * Points custom exam names at an official exam, which also takes over the entry's name. An item that
 * already lists that exam, or lists several of the names, keeps a single entry.
 */
export async function linkCustomExamsToExam(
  executor: DbExecutor,
  names: string[],
  exam: { id: number; examName: string },
  options: { caseInsensitive?: boolean } = {}
) {
  if (names.length === 0) return;
  const matches = (alias: string): RawBuilder<boolean> =>
    options.caseInsensitive
      ? sql<boolean>`lower(${sql.ref(`${alias}.exam_name`)}) IN (${sql.join(names.map((n) => n.toLowerCase()))})`
      : sql<boolean>`${sql.ref(`${alias}.exam_name`)} IN (${sql.join(names)})`;

  for (const target of TARGETS) {
    const { join, fk } = target;
    const dropped = await sql<ContentIdRow>`DELETE FROM ${sql.table(join)} c
      WHERE c.exam_id IS NULL AND ${matches("c")}
        AND (
          EXISTS (
            SELECT 1 FROM ${sql.table(join)} o
            WHERE o.${sql.ref(fk)} = c.${sql.ref(fk)} AND o.id <> c.id
              AND (o.exam_id = ${exam.id} OR lower(o.exam_name) = lower(${exam.examName}))
          )
          OR EXISTS (
            SELECT 1 FROM ${sql.table(join)} o
            WHERE o.${sql.ref(fk)} = c.${sql.ref(fk)} AND o.exam_id IS NULL AND ${matches("o")}
              AND (o.position, o.id) < (c.position, c.id)
          )
        )
      RETURNING c.${sql.ref(fk)} AS "contentId"`.execute(executor);
    const linked = await sql<ContentIdRow>`UPDATE ${sql.table(join)} j
      SET exam_id = ${exam.id}, exam_name = ${exam.examName}
      WHERE j.exam_id IS NULL AND ${matches("j")}
      RETURNING j.${sql.ref(fk)} AS "contentId"`.execute(executor);
    await resyncPrimaryExams(
      executor,
      target,
      [...dropped.rows, ...linked.rows].map((row) => row.contentId)
    );
  }
}