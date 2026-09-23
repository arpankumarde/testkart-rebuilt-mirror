import { db } from "./db";
import { sql } from "kysely";
import { contentInExam } from "./contentExams";
import type { OutputType } from "../endpoints/exam-products/counts_GET.schema";

/**
 * Direct-DB counterpart to endpoints/exam-products/counts_GET.ts, for use
 * ONLY from page prefetch (pages/exams.$examSlug.mock-tests/courses/
 * study-notes/bundles.prefetch.ts) — see helpers/fetchBlogPostDetailServer.tsx
 * for why the network endpoint can't be called from within the SSR pass.
 * Keep in sync with endpoints/exam-products/counts_GET.ts.
 *
 * ExamProductListingPage gates its ENTIRE render (not just the per-type
 * body) on isExamFetching || isCountsFetching, so this query must be
 * prefetched alongside exam-detail or the whole page falls back to the
 * top-level skeleton during SSR even when the product list itself is cached.
 */
export async function fetchExamProductCountsServer(examSlug: string): Promise<OutputType> {
  const exam = await db
    .selectFrom("exams")
    .select("id")
    .where("examSlug", "=", examSlug)
    .executeTakeFirst();

  if (!exam) {
    return {
      examId: null,
      counts: { mockTests: 0, digitalProducts: 0, courses: 0, bundles: 0 },
    };
  }

  const examId = exam.id;

  const [mockTestsResult, digitalProductsResult, coursesResult, bundlesResult] = await Promise.all([
    db
      .selectFrom("mockTests")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where(contentInExam("mock_test", "mockTests.id", "mockTests.examId", examId))
      .where("isPublished", "=", true)
      .where("deletedAt", "is", null)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom("liveTests")
              .select("liveTests.id")
              .whereRef("liveTests.mockTestId", "=", "mockTests.id")
          )
        )
      )
      .executeTakeFirst(),
    db
      .selectFrom("digitalProducts")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where(contentInExam("digital_product", "digitalProducts.id", "digitalProducts.examId", examId))
      .where("status", "=", "published")
      .where("isPublished", "=", true)
      .executeTakeFirst(),
    db
      .selectFrom("courses")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where(contentInExam("course", "courses.id", "courses.examId", examId))
      .where("status", "=", "published")
      .executeTakeFirst(),
    db
      .selectFrom("courseBundles")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("isPublished", "=", true)
      .where(
        sql<boolean>`EXISTS (
          SELECT 1 FROM course_bundle_items cbi
          LEFT JOIN mock_tests mt ON mt.id = cbi.mock_test_id
          LEFT JOIN digital_products dp ON dp.id = cbi.digital_product_id
          LEFT JOIN courses c ON c.id = cbi.course_id
          WHERE cbi.bundle_id = course_bundles.id
            AND (${contentInExam("mock_test", "mt.id", "mt.examId", examId)}
              OR ${contentInExam("digital_product", "dp.id", "dp.examId", examId)}
              OR ${contentInExam("course", "c.id", "c.examId", examId)})
        )`
      )
      .executeTakeFirst(),
  ]);

  return {
    examId,
    counts: {
      mockTests: Number(mockTestsResult?.count ?? 0),
      digitalProducts: Number(digitalProductsResult?.count ?? 0),
      courses: Number(coursesResult?.count ?? 0),
      bundles: Number(bundlesResult?.count ?? 0),
    },
  };
}
