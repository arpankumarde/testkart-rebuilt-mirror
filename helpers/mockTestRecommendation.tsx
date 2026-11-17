import { sql, type RawBuilder } from "kysely";

/**
 * How the public catalogue promotes well-built test series.
 *
 * The value score (0-100) rewards what a student gets for the money, read
 * straight off the series row so it is cheap enough to sort a list by:
 * depth (questions and tests), a free test to try in a paid series, a
 * rating backed by a few reviews, a complete listing and a verified teacher.
 * It needs `mock_tests` and `teachers` (the series teacher) in the query.
 *
 * Used as the tiebreak of the "popular" sort and as the "recommended" sort,
 * which the series page uses for its "more for this exam" block. Keep the
 * list endpoint and its SSR counterpart (helpers/fetchTestsListServer) on
 * the same expression.
 */
export const mockTestValueScoreSql = sql<number>`(
  LEAST(COALESCE(mock_tests.total_questions, 0), 1000) / 1000.0 * 35
  + LEAST(COALESCE(mock_tests.total_tests, 0), 10) / 10.0 * 15
  + CASE WHEN COALESCE(mock_tests.free_tests_count, 0) > 0 AND mock_tests.price > 0 THEN 10 ELSE 0 END
  + CASE WHEN COALESCE(mock_tests.reviews_count, 0) >= 3
      THEN GREATEST(LEAST((COALESCE(mock_tests.rating, 0) - 3) / 2.0, 1), 0) * 15
      ELSE 0 END
  + CASE WHEN mock_tests.thumbnail_url IS NOT NULL THEN 5 ELSE 0 END
  + CASE WHEN length(COALESCE(mock_tests.long_description, '')) >= 300 THEN 10 ELSE 0 END
  + CASE WHEN COALESCE(teachers.is_verified, false) THEN 10 ELSE 0 END
)`;

/**
 * WHERE fragment: the row is another series listed under any exam of the
 * given series (its primary exam or its mock_test_exams entries). A series
 * with no exam matches nothing.
 */
const TITLE_STOP_WORDS = new Set([
  "mock", "mocks", "test", "tests", "series", "full", "length", "free", "paid", "practice", "set", "sets",
  "for", "the", "and", "with", "of", "in", "on", "to", "by", "new", "latest", "pattern", "complete", "online",
  "exam", "exams", "prelims", "mains", "tier", "paper", "level", "grand", "live", "single", "question",
  "questions", "pyq", "previous", "year", "sectional", "chapter", "wise", "topic", "subject", "class", "all",
  "india", "master", "plan", "best", "top",
]);

/**
 * The two leading distinctive words of a series title, which in practice name
 * the exam ("UP TGT Commerce Mock Test Series 2026" gives up, tgt). Empty when
 * the title has fewer than two such words (for example a Hindi-only title).
 */
export function leadingTitleWords(title: string): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !TITLE_STOP_WORDS.has(w));
  const unique = [...new Set(words)];
  return unique.length >= 2 ? unique.slice(0, 2) : [];
}

/**
 * WHERE fragment for the series page's related block: another series that
 * shares an exam with the given one, or whose title carries both of its
 * leading title words. The title rule is what links the many series that
 * were published without an exam.
 */
export function relatedToMockTest(seriesId: number, title: string | null | undefined): RawBuilder<boolean> {
  const words = leadingTitleWords(title ?? "");
  if (words.length < 2) return sharesExamWithMockTest(seriesId);
  const titleMatch = sql.join(
    words.map((w) => sql`mock_tests.title ~* ${"\\m" + w + "\\M"}`),
    sql` AND `
  );
  return sql<boolean>`(${sharesExamWithMockTest(seriesId)} OR (mock_tests.id <> ${seriesId} AND ${titleMatch}))`;
}

export function sharesExamWithMockTest(seriesId: number): RawBuilder<boolean> {
  const examsOfSeries = sql`(
    SELECT src.exam_id FROM mock_tests src WHERE src.id = ${seriesId} AND src.exam_id IS NOT NULL
    UNION
    SELECT se.exam_id FROM mock_test_exams se WHERE se.mock_test_id = ${seriesId} AND se.exam_id IS NOT NULL
  )`;
  return sql<boolean>`(mock_tests.id <> ${seriesId} AND (
    mock_tests.exam_id IN ${examsOfSeries}
    OR EXISTS (
      SELECT 1 FROM mock_test_exams ce WHERE ce.mock_test_id = mock_tests.id AND ce.exam_id IN ${examsOfSeries}
    )
  ))`;
}
