import { db } from "./db";
import { sql } from "kysely";
import type { InputType, OutputType } from "../endpoints/tests/list_GET.schema";
import { slugify } from "./slugify";

/**
 * Direct-DB counterpart to endpoints/tests/list_GET.ts, for use ONLY from
 * page prefetch (e.g. pages/exams.$examSlug.mock-tests.prefetch.ts) — see
 * helpers/fetchBlogPostDetailServer.tsx for why the network endpoint can't
 * be called from within the SSR pass.
 *
 * Enrollment personalization (isEnrolled) is intentionally always false
 * here, matching the same anonymous-safe convention already used by
 * fetchTestDetailsServer for the mock test detail page's SSR pass — the
 * client re-fetches with real session data after hydration.
 *
 * Keep in sync with endpoints/tests/list_GET.ts.
 */
export async function fetchTestsListServer(filters: InputType = {}): Promise<OutputType> {
  const search = filters.search;
  const examId = filters.examId;
  const language = filters.language;
  const priceType = filters.priceType;
  const minPrice = filters.minPrice;
  const maxPrice = filters.maxPrice;
  const sortBy = filters.sortBy || "popular";
  const page = filters.page ? parseInt(filters.page, 10) : 1;
  const limit = filters.limit ? parseInt(filters.limit, 10) : 20;

  let query = db
    .selectFrom("mockTests")
    .innerJoin("users", "users.id", "mockTests.teacherId")
    .leftJoin("exams", "exams.id", "mockTests.examId")
    .select([
      "mockTests.id",
      "mockTests.slug",
      "mockTests.title",
      "mockTests.description",
      "mockTests.subject",
      "mockTests.price",
      "mockTests.discountPrice",
      "mockTests.totalQuestions",
      "mockTests.thumbnailUrl",
      "mockTests.introVideoUrl",
      "mockTests.totalTests",
      "mockTests.freeTestsCount",
      "mockTests.creatorName",
      "mockTests.studentsEnrolled",
      "mockTests.rating",
      "mockTests.reviewsCount",
      "mockTests.examName",
      "mockTests.language",
      "mockTests.views",
      "users.displayName as teacherName",
      "users.isVerified as teacherIsVerified",
      "users.avatarUrl as teacherAvatarUrl",
      "users.tagline as teacherTagline",
      "users.yearsOfExperience as teacherYearsOfExperience",
      "users.slug as teacherSlug",
      "exams.examSlug",
      sql<number>`COALESCE((
        SELECT SUM(
          CASE
            WHEN mti.subject_wise_timing = true THEN
              COALESCE((SELECT SUM(COALESCE(tis.duration_minutes, 0)) FROM test_item_subjects tis WHERE tis.test_item_id = mti.id), 0)
            WHEN mti.question_wise_timing = true THEN
              CEIL(COALESCE((SELECT SUM(COALESCE(tq.duration_seconds, 0)) FROM test_questions tq WHERE tq.test_id = mti.id), 0) / 60.0)
            ELSE mti.duration_minutes
          END
        )
        FROM mock_test_items mti
        WHERE mti.package_id = "mock_tests"."id"
        AND mti.deleted_at IS NULL
      ), 0)`.as("durationMinutes"),
      // Trashed items excluded, matching endpoints/tests/list_GET.ts — the SSR
      // and client passes must advertise the same question count or the number
      // changes under the user on hydration.
      (eb) => eb.selectFrom("testQuestions")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .whereRef("testQuestions.testId", "in", (eb) =>
          eb.selectFrom("mockTestItems")
            .select("mockTestItems.id")
            .whereRef("mockTestItems.packageId", "=", "mockTests.id")
            .where("mockTestItems.deletedAt", "is", null)
        )
        .as("actualQuestionCount"),
    ])
    .where("mockTests.isPublished", "=", true)
    .where("mockTests.deletedAt", "is", null);

  query = query.where((eb) =>
    eb.not(
      eb.exists(
        eb.selectFrom("liveTests")
          .select("liveTests.id")
          .whereRef("liveTests.mockTestId", "=", "mockTests.id")
      )
    )
  );

  if (search) {
    const searchPattern = `%${search}%`;
    query = query.where((eb) =>
      eb.or([
        eb("mockTests.title", "ilike", searchPattern),
        eb("mockTests.description", "ilike", searchPattern),
        eb("mockTests.subject", "ilike", searchPattern),
        eb("mockTests.creatorName", "ilike", searchPattern),
        eb("mockTests.examName", "ilike", searchPattern),
      ])
    );
  }

  if (examId) {
    query = query.where("mockTests.examId", "=", parseInt(examId, 10));
  }

  if (language) {
    const languages = language.split(",").map((l) => l.trim());
    query = query.where((eb) => eb.or(languages.map((lang) => eb("mockTests.language", "=", lang))));
  }

  if (priceType === "free") {
    query = query.where("mockTests.price", "=", "0");
  } else if (priceType === "paid") {
    query = query.where("mockTests.price", ">", "0");
    if (minPrice) query = query.where("mockTests.price", ">=", minPrice);
    if (maxPrice) query = query.where("mockTests.price", "<=", maxPrice);
  }

  const countQuery = query.clearSelect().select((eb) => eb.fn.countAll<number>().as("count"));
  const countResult = await countQuery.executeTakeFirst();
  const totalCount = Number(countResult?.count ?? 0);

  switch (sortBy) {
    case "price_asc":
      query = query.orderBy("mockTests.price", "asc");
      break;
    case "price_desc":
      query = query.orderBy("mockTests.price", "desc");
      break;
    case "popular":
      query = query.orderBy(sql`(
        (SELECT COUNT(*) FROM mock_test_enrollments WHERE mock_test_id = mock_tests.id AND enrolled_at > NOW() - INTERVAL '7 days') * 3 +
        (SELECT COUNT(*) FROM mock_test_enrollments WHERE mock_test_id = mock_tests.id AND enrolled_at > NOW() - INTERVAL '30 days')
      )`, "desc").orderBy(sql`COALESCE(mock_tests.views, 0)`, "desc");
      break;
    case "rating":
      query = query.orderBy(sql`"mock_tests"."rating" desc nulls last`);
      break;
    case "newest":
    default:
      query = query.orderBy("mockTests.createdAt", "desc");
      break;
  }

  const offset = (page - 1) * limit;
  query = query.limit(limit).offset(offset);

  const tests = await query.execute();

  const testIds = tests.map((test) => test.id);
  const mockTestItemsByPackage: Map<number, { total: number; free: number }> = new Map();

  if (testIds.length > 0) {
    const mockTestItems = await db
      .selectFrom("mockTestItems")
      .select(["packageId", "isFree"])
      .where("packageId", "in", testIds)
      .where("deletedAt", "is", null)
      .execute();

    mockTestItems.forEach((item) => {
      const existing = mockTestItemsByPackage.get(item.packageId) || { total: 0, free: 0 };
      existing.total += 1;
      if (item.isFree) existing.free += 1;
      mockTestItemsByPackage.set(item.packageId, existing);
    });
  }

  const testsWithEnrollment = tests.map((test) => {
    const actualQuestionCount = test.actualQuestionCount ?? 0;
    const durationMinutes = test.durationMinutes ?? 0;
    const price = parseFloat(test.price);
    const discountPrice = test.discountPrice ? parseFloat(test.discountPrice) : null;
    const rating = test.rating ? parseFloat(test.rating) : null;

    const itemCounts = mockTestItemsByPackage.get(test.id) || { total: 0, free: 0 };
    const totalTests = itemCounts.total;
    const freeTestsCount = itemCounts.free;

    let examSlug = test.examSlug;
    if (!examSlug && test.examName) {
      const fallbackSlug = slugify(test.examName);
      examSlug = fallbackSlug || "general-exam";
    }

    return {
      ...test,
      durationMinutes,
      price,
      discountPrice,
      rating,
      actualQuestionCount,
      totalTests,
      freeTestsCount,
      isEnrolled: false,
      examSlug,
      views: test.views ?? 0,
      teacherIsVerified: !!test.teacherIsVerified,
      teacherAvatarUrl: test.teacherAvatarUrl ?? null,
      teacherTagline: test.teacherTagline ?? null,
      teacherYearsOfExperience: test.teacherYearsOfExperience ?? null,
      teacherSlug: test.teacherSlug ?? null,
    };
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    tests: testsWithEnrollment,
    pagination: { page, limit, totalCount, totalPages },
  };
}
