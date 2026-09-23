import { sql, type RawBuilder } from "kysely";
import { db } from "./db";
import type { DbExecutor } from "./enrollmentCounters";

/**
 * Test series, live tests (via their mock_tests row), study notes and courses can be listed under up to
 * MAX_CONTENT_EXAMS exams. The full ordered list lives in the *_exams join tables; the row's own
 * exam_id / exam_name always mirror the first entry (the primary exam), so display code and the
 * shipped mobile app keep reading a single exam.
 */
export const MAX_CONTENT_EXAMS = 5;

export type ContentExamKind = "mock_test" | "digital_product" | "course";

export interface ContentExam {
  examId: number | null;
  examName: string;
}

const KIND_TABLES = {
  mock_test: { base: "mockTests", join: "mock_test_exams", fk: "mock_test_id" },
  digital_product: { base: "digitalProducts", join: "digital_product_exams", fk: "digital_product_id" },
  course: { base: "courses", join: "course_exams", fk: "course_id" },
} as const;

export class ContentExamError extends Error {}

const PLACEHOLDER_NAMES = new Set(["unspecified"]);

function cleanNames(names: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (PLACEHOLDER_NAMES.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

async function lookupOfficialExams(names: string[]) {
  if (names.length === 0) return new Map<string, { id: number; examName: string }>();
  const lowered = names.map((n) => n.toLowerCase());
  const rows = await db
    .selectFrom("exams")
    .select(["id", "examName", "fullName"])
    .where((eb) =>
      eb.or([
        eb(sql`lower(exam_name)`, "in", lowered),
        eb(sql`lower(full_name)`, "in", lowered),
      ])
    )
    .orderBy("id")
    .execute();
  const byName = new Map<string, { id: number; examName: string }>();
  for (const row of rows) {
    for (const key of [row.examName.toLowerCase(), row.fullName.toLowerCase()]) {
      if (!byName.has(key)) byName.set(key, { id: row.id, examName: row.examName });
    }
  }
  return byName;
}

/**
 * Turns a request's exam fields into the list to store, or undefined when the request leaves exams alone.
 *
 * - `examNames` (new clients): every name must be an official exam, except custom names the item already
 *   carries, which may be kept but not added.
 * - `examName` (older clients, AI and MCP callers): sets the primary exam and keeps the other exams. A name
 *   that is not official is still stored as a custom name, as before. null or "" clears every exam.
 */
export async function resolveExamSelection(input: {
  examNames?: string[] | null;
  examName?: string | null;
  existing?: ContentExam[];
}): Promise<ContentExam[] | undefined> {
  const existing = input.existing ?? [];

  if (input.examNames !== undefined) {
    const names = cleanNames(input.examNames ?? []);
    const official = await lookupOfficialExams(names);
    const existingCustom = new Map(
      existing.filter((e) => e.examId === null).map((e) => [e.examName.toLowerCase(), e.examName])
    );
    const result: ContentExam[] = [];
    const unknown: string[] = [];
    for (const name of names) {
      const match = official.get(name.toLowerCase());
      if (match) {
        result.push({ examId: match.id, examName: match.examName });
      } else if (existingCustom.has(name.toLowerCase())) {
        result.push({ examId: null, examName: existingCustom.get(name.toLowerCase())! });
      } else {
        unknown.push(name);
      }
    }
    if (unknown.length > 0) {
      throw new ContentExamError(
        `Pick exams from the exam list. Not found: ${unknown.join(", ")}`
      );
    }
    return finalize(result);
  }

  if (input.examName !== undefined) {
    const [name] = cleanNames([input.examName]);
    if (!name) return [];
    const official = await lookupOfficialExams([name]);
    const match = official.get(name.toLowerCase());
    const primary: ContentExam = match
      ? { examId: match.id, examName: match.examName }
      : { examId: null, examName: name };
    return finalize([primary, ...existing.slice(1)]).slice(0, MAX_CONTENT_EXAMS);
  }

  return undefined;
}

function finalize(exams: ContentExam[]): ContentExam[] {
  const seenIds = new Set<number>();
  const seenNames = new Set<string>();
  const out: ContentExam[] = [];
  for (const exam of exams) {
    const nameKey = exam.examName.toLowerCase();
    if (exam.examId !== null && seenIds.has(exam.examId)) continue;
    if (seenNames.has(nameKey)) continue;
    if (exam.examId !== null) seenIds.add(exam.examId);
    seenNames.add(nameKey);
    out.push(exam);
  }
  if (out.length > MAX_CONTENT_EXAMS) {
    throw new ContentExamError(`An item can be listed under at most ${MAX_CONTENT_EXAMS} exams.`);
  }
  return out;
}

/**
 * The row fields that mirror the primary exam. Spread into an insert or update of the base row.
 */
export function primaryExamFields(exams: ContentExam[], emptyExamName: string | null = null) {
  const primary = exams[0];
  return {
    examId: primary ? primary.examId : null,
    examName: primary ? primary.examName : emptyExamName,
  };
}

/**
 * Replaces an item's exam list and keeps the row's primary exam in step. Pass the transaction when
 * called inside one (the pool has a single connection).
 */
export async function saveContentExams(
  executor: DbExecutor,
  kind: ContentExamKind,
  contentId: number,
  exams: ContentExam[],
  emptyExamName: string | null = null
): Promise<void> {
  const { base, join, fk } = KIND_TABLES[kind];
  await sql`DELETE FROM ${sql.table(join)} WHERE ${sql.ref(fk)} = ${contentId}`.execute(executor);
  for (const [position, exam] of exams.entries()) {
    await sql`INSERT INTO ${sql.table(join)} (${sql.ref(fk)}, exam_id, exam_name, position)
      VALUES (${contentId}, ${exam.examId}, ${exam.examName}, ${position})`.execute(executor);
  }
  await executor
    .updateTable(base)
    .set(primaryExamFields(exams, emptyExamName))
    .where("id", "=", contentId)
    .execute();
}

/**
 * Exam lists for several items, in the order they were picked. Items with no join rows fall back to the
 * row's own exam, so content written by older code still reports its exam.
 */
export async function loadContentExams(
  executor: DbExecutor,
  kind: ContentExamKind,
  contentIds: number[]
): Promise<Map<number, ContentExam[]>> {
  const result = new Map<number, ContentExam[]>();
  const ids = [...new Set(contentIds)];
  if (ids.length === 0) return result;
  const { base, join, fk } = KIND_TABLES[kind];

  const joined = await sql<{ contentId: number; examId: number | null; examName: string }>`
    SELECT ce.${sql.ref(fk)} AS "contentId", ce.exam_id AS "examId",
      COALESCE(ex.exam_name, ce.exam_name) AS "examName"
    FROM ${sql.table(join)} ce
    LEFT JOIN exams ex ON ex.id = ce.exam_id
    WHERE ce.${sql.ref(fk)} IN (${sql.join(ids)})
    ORDER BY ce.${sql.ref(fk)}, ce.position, ce.id`.execute(executor);
  for (const row of joined.rows) {
    const list = result.get(row.contentId) ?? [];
    list.push({ examId: row.examId, examName: row.examName });
    result.set(row.contentId, list);
  }

  const missing = ids.filter((id) => !result.has(id));
  if (missing.length > 0) {
    const rows = await executor
      .selectFrom(base)
      .select(["id", "examId", "examName"])
      .where("id", "in", missing)
      .execute();
    for (const row of rows) {
      const [name] = cleanNames([row.examName]);
      result.set(row.id, name ? [{ examId: row.examId, examName: name }] : []);
    }
  }
  return result;
}

export async function loadContentExamList(
  executor: DbExecutor,
  kind: ContentExamKind,
  contentId: number
): Promise<ContentExam[]> {
  return (await loadContentExams(executor, kind, [contentId])).get(contentId) ?? [];
}

/**
 * WHERE fragment: the item is listed under the exam, as its primary exam or any other.
 * `idRef` / `primaryExamIdRef` are query-builder references such as "mockTests.id" or "mt.examId".
 */
export function contentInExam(
  kind: ContentExamKind,
  idRef: string,
  primaryExamIdRef: string,
  examId: number
): RawBuilder<boolean> {
  const { join, fk } = KIND_TABLES[kind];
  return sql<boolean>`(${sql.ref(primaryExamIdRef)} = ${examId} OR EXISTS (
    SELECT 1 FROM ${sql.table(join)} ce WHERE ce.${sql.ref(fk)} = ${sql.ref(idRef)} AND ce.exam_id = ${examId}
  ))`;
}

/**
 * Same as contentInExam, matched on an exam slug instead of an id.
 */
export function contentInExamSlug(
  kind: ContentExamKind,
  idRef: string,
  primaryExamIdRef: string,
  examSlug: string
): RawBuilder<boolean> {
  const { join, fk } = KIND_TABLES[kind];
  return sql<boolean>`(EXISTS (
    SELECT 1 FROM exams ex WHERE ex.exam_slug = ${examSlug} AND (
      ex.id = ${sql.ref(primaryExamIdRef)} OR EXISTS (
        SELECT 1 FROM ${sql.table(join)} ce WHERE ce.${sql.ref(fk)} = ${sql.ref(idRef)} AND ce.exam_id = ex.id
      )
    )
  ))`;
}
