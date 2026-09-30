import { sql } from "kysely";
import { db } from "./db";
import { TOP_EXAMS } from "./homepageTopExams";

/**
 * Total products on sale per homepage top exam, keyed by exam slug: published
 * test series (not live tests), study notes, courses and bundles, counted the
 * same way as endpoints/exam-products/counts_GET.ts (an item counts under its
 * primary exam and every other exam it is listed under). One query for all
 * cards instead of one counts request each.
 */
export async function homepageFetchTopExamCounts(): Promise<Record<string, number>> {
  const slugs = TOP_EXAMS.map((exam) => exam.slug);

  // The *_l CTEs are (item, exam) pairs from the row's primary exam plus its
  // join table; UNION drops the pair the two repeat.
  const { rows } = await sql<{ examSlug: string; total: number }>`
    WITH target AS (
      SELECT id, exam_slug FROM exams WHERE exam_slug IN (${sql.join(slugs)})
    ),
    mt_l AS (
      SELECT id AS content_id, exam_id FROM mock_tests WHERE exam_id IN (SELECT id FROM target)
      UNION SELECT mock_test_id, exam_id FROM mock_test_exams WHERE exam_id IN (SELECT id FROM target)
    ),
    dp_l AS (
      SELECT id AS content_id, exam_id FROM digital_products WHERE exam_id IN (SELECT id FROM target)
      UNION SELECT digital_product_id, exam_id FROM digital_product_exams WHERE exam_id IN (SELECT id FROM target)
    ),
    c_l AS (
      SELECT id AS content_id, exam_id FROM courses WHERE exam_id IN (SELECT id FROM target)
      UNION SELECT course_id, exam_id FROM course_exams WHERE exam_id IN (SELECT id FROM target)
    ),
    bundle_l AS (
      SELECT cbi.bundle_id, l.exam_id FROM course_bundle_items cbi JOIN mt_l l ON l.content_id = cbi.mock_test_id
      UNION SELECT cbi.bundle_id, l.exam_id FROM course_bundle_items cbi JOIN dp_l l ON l.content_id = cbi.digital_product_id
      UNION SELECT cbi.bundle_id, l.exam_id FROM course_bundle_items cbi JOIN c_l l ON l.content_id = cbi.course_id
    ),
    listed AS (
      SELECT l.exam_id FROM mt_l l JOIN mock_tests m ON m.id = l.content_id
      WHERE m.is_published = true AND m.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM live_tests lt WHERE lt.mock_test_id = m.id)
      UNION ALL
      SELECT l.exam_id FROM dp_l l JOIN digital_products d ON d.id = l.content_id
      WHERE d.status = 'published' AND d.is_published = true
      UNION ALL
      SELECT l.exam_id FROM c_l l JOIN courses c ON c.id = l.content_id WHERE c.status = 'published'
      UNION ALL
      SELECT b.exam_id FROM bundle_l b JOIN course_bundles cb ON cb.id = b.bundle_id WHERE cb.is_published = true
    )
    SELECT t.exam_slug AS "examSlug", COUNT(l.exam_id)::int AS total
    FROM target t LEFT JOIN listed l ON l.exam_id = t.id
    GROUP BY t.exam_slug
  `.execute(db);

  return Object.fromEntries(rows.map((row) => [row.examSlug, Number(row.total)]));
}
