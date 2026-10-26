import { sql } from "kysely";
import { db } from "./db";
import { examNewsServer } from "./examNewsServer";
import { fetchHotExamIds } from "./fetchExamDirectoryServer";
import { PINNED_TEACHER_IDS } from "./pinnedTeachers";
import { courseDiscountPrice } from "./coursePricing";
import { slugify } from "./slugify";
import type {
  ExamResource,
  ExamResourceGroup,
  ExamResourceKind,
  ExamResourceTeacher,
  InputType,
  OutputType,
} from "../endpoints/exam-news/resources_GET.schema";

/*
 * The Exam News sidebar's study resources: published, public, paid courses and test series listed
 * under an exam (primary or any other, via the *_exams join tables) whose teacher is verified on their
 * users row. Free ones (the price a student pays is 0, by the same rules as the catalogue cards) are
 * left out. The sidebar call returns one teacher's top course and test series per exam; `all` returns every
 * verified teacher's, for Show more on a single-exam page.
 */

const HOT_CANDIDATES = 40;
// Hot exams with resources returned to the card; it shows the first two and the rest behind Show more.
const SIDEBAR_HOT_EXAMS = 10;
const SIDEBAR_PER_KIND = 1;
const ALL_PER_KIND = 12;
const KIND_ORDER: ExamResourceKind[] = ["course", "test_series"];

type Row = {
  kind: ExamResourceKind;
  id: number;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  price: number | string | null;
  discountPrice: number | string | null;
  views: number | string | null;
  examId: number;
  teacherId: number;
  teacherName: string | null;
  teacherSlug: string | null;
  teacherAvatarUrl: string | null;
};

const VERIFIED_TEACHER = sql`u.is_verified = true AND u.is_active = true`;

const teacherColumns = sql`u.id AS "teacherId", u.display_name AS "teacherName", u.slug AS "teacherSlug", u.avatar_url AS "teacherAvatarUrl"`;

async function loadRows(examIds: number[]): Promise<Row[]> {
  if (examIds.length === 0) return [];
  const ids = sql.join(examIds);
  const [courses, tests] = await Promise.all([
    sql<Row>`
      SELECT 'course' AS kind, c.id, c.title, c.slug,
        COALESCE(NULLIF(c.thumbnail_image_url, ''), NULLIF(c.thumbnail_url, '')) AS "thumbnailUrl",
        c.price, c.discount_price AS "discountPrice", COALESCE(c.views, 0) AS views,
        ex.exam_id AS "examId", ${teacherColumns}
      FROM courses c
      JOIN users u ON u.id = c.teacher_id
      CROSS JOIN LATERAL (
        SELECT c.exam_id UNION SELECT ce.exam_id FROM course_exams ce WHERE ce.course_id = c.id
      ) ex(exam_id)
      WHERE ${VERIFIED_TEACHER}
        AND c.status = 'published' AND c.visibility = 'public'
        AND c.price > 0
        AND ex.exam_id IN (${ids})`.execute(db),
    sql<Row>`
      SELECT 'test_series' AS kind, m.id, m.title, m.slug,
        NULLIF(m.thumbnail_url, '') AS "thumbnailUrl",
        m.price, m.discount_price AS "discountPrice", COALESCE(m.views, 0) AS views,
        ex.exam_id AS "examId", ${teacherColumns}
      FROM mock_tests m
      JOIN users u ON u.id = m.teacher_id
      CROSS JOIN LATERAL (
        SELECT m.exam_id UNION SELECT ce.exam_id FROM mock_test_exams ce WHERE ce.mock_test_id = m.id
      ) ex(exam_id)
      WHERE ${VERIFIED_TEACHER}
        AND m.is_published = true AND m.visibility = 'public' AND m.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.mock_test_id = m.id)
        AND m.price > 0 AND (m.discount_price IS NULL OR m.discount_price > 0)
        AND ex.exam_id IN (${ids})`.execute(db),
  ]);
  return [...courses.rows, ...tests.rows];
}

const num = (value: number | string | null) => {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) ? n : null;
};

const HREF: Record<ExamResourceKind, string> = {
  course: "/course/",
  test_series: "/mock-test/",
};

function toResource(row: Row): ExamResource {
  const price = num(row.price) ?? 0;
  return {
    kind: row.kind,
    id: row.id,
    title: row.title,
    href: `${HREF[row.kind]}${row.slug}`,
    thumbnailUrl: row.thumbnailUrl,
    price,
    // Same price rules as the catalogue cards for each type.
    discountPrice: row.kind === "course" ? courseDiscountPrice(row.price, row.discountPrice) : num(row.discountPrice),
  };
}

/* Up to `perKind` of each type, most viewed first, in Courses / Test Series / Study Notes order. */
function pickResources(rows: Row[], perKind: number): ExamResource[] {
  return KIND_ORDER.flatMap((kind) =>
    rows
      .filter((row) => row.kind === kind)
      .sort((a, b) => (num(b.views) ?? 0) - (num(a.views) ?? 0) || b.id - a.id)
      .slice(0, perKind)
      .map(toResource)
  );
}

/* Pinned teachers first, as on the catalogue; then the most resources, then the most viewed. */
function rankTeachers(rows: Row[]): Row[][] {
  const byTeacher = new Map<number, Row[]>();
  for (const row of rows) byTeacher.set(row.teacherId, [...(byTeacher.get(row.teacherId) ?? []), row]);
  const views = (list: Row[]) => list.reduce((sum, row) => sum + (num(row.views) ?? 0), 0);
  const pinned = (id: number) => (PINNED_TEACHER_IDS.includes(id) ? 0 : 1);
  return [...byTeacher.values()].sort(
    (a, b) =>
      pinned(a[0].teacherId) - pinned(b[0].teacherId) ||
      b.length - a.length ||
      views(b) - views(a) ||
      a[0].teacherId - b[0].teacherId
  );
}

function buildGroup(exam: ExamResourceGroup["exam"], rows: Row[], all: boolean): ExamResourceGroup | null {
  if (rows.length === 0) return null;
  const ranked = rankTeachers(rows);
  const teachers: ExamResourceTeacher[] = (all ? ranked : ranked.slice(0, 1)).map((list) => {
    const first = list[0];
    const name = first.teacherName?.trim() || "Testkart Teacher";
    return {
      id: first.teacherId,
      name,
      slug: first.teacherSlug || slugify(name),
      avatarUrl: first.teacherAvatarUrl || null,
      total: list.length,
      resources: pickResources(list, all ? ALL_PER_KIND : SIDEBAR_PER_KIND),
    };
  });
  return { exam, teachers, teacherCount: ranked.length, resourceCount: rows.length };
}

async function loadExams(where: { slug: string } | { ids: number[] }) {
  let query = db.selectFrom("exams").select(["id", "examName as name", "examSlug as slug"]);
  query = "slug" in where ? query.where("examSlug", "=", where.slug) : query.where("id", "in", where.ids);
  return query.execute();
}

export async function fetchExamNewsResources(input: InputType): Promise<OutputType> {
  if (input.exam) {
    const [exam] = await loadExams({ slug: input.exam });
    if (!exam) return { source: "exam", groups: [] };
    const group = buildGroup(exam, await loadRows([exam.id]), !!input.all);
    return { source: "exam", groups: group ? [group] : [] };
  }

  await examNewsServer.promoteDue();
  const hotIds = (await fetchHotExamIds()).slice(0, HOT_CANDIDATES);
  if (hotIds.length === 0) return { source: "hot", groups: [] };
  const [exams, rows] = await Promise.all([loadExams({ ids: hotIds }), loadRows(hotIds)]);
  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  const groups: ExamResourceGroup[] = [];
  for (const id of hotIds) {
    const exam = examById.get(id);
    const group = exam ? buildGroup(exam, rows.filter((row) => row.examId === id), false) : null;
    if (group) groups.push(group);
    if (groups.length === SIDEBAR_HOT_EXAMS) break;
  }
  return { source: "hot", groups };
}
