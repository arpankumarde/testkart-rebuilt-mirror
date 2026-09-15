import { db } from "../../helpers/db";
import { sql } from "kysely";
import { schema, OutputType } from "./by-subject_GET.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { hasStudentEnrolledInMockTest } from "../../helpers/hasStudentEnrolledInMockTest";

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const examName = url.searchParams.get("examName");

    // Validate using a temporary object that fits the schema
    schema.parse({ examName });

    // Try to get authenticated user session (don't fail if unauthenticated)
    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch (error) {
      // User is not authenticated, which is fine for this public endpoint
      console.log("User not authenticated, proceeding without enrollment data");
    }

    if (!examName) {
      // If no examName is provided, return an empty list as per requirements
      return new Response(superjson.stringify({ tests: [] } satisfies OutputType));
    }

    const tests = await db
      .selectFrom("mockTests")
      .innerJoin("exams", "exams.id", "mockTests.examId")
      .innerJoin("users", "users.id", "mockTests.teacherId")
      .select([
        "mockTests.id",
        "mockTests.slug",
        "mockTests.title",
        "mockTests.description",
        "mockTests.subject",
        "mockTests.price",
        "mockTests.discountPrice",
                // Calculate total duration accounting for subject-wise and question-wise timing
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
        ), 0)`.as('durationMinutes'),
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
        // Count actual questions from test_questions table across all test items
        // in the package, excluding trashed items — see the matching note in
        // endpoints/tests/list_GET.ts.
        (eb) => eb.selectFrom('testQuestions')
          .select((eb) => eb.fn.countAll<number>().as('count'))
          .whereRef('testQuestions.testId', 'in', (eb) =>
            eb.selectFrom('mockTestItems')
              .select('mockTestItems.id')
              .whereRef('mockTestItems.packageId', '=', 'mockTests.id')
              .where('mockTestItems.deletedAt', 'is', null)
          )
          .as('actualQuestionCount')
      ])
      .where("mockTests.isPublished", "=", true)
      .where("mockTests.deletedAt", "is", null)
      .where((eb) =>
        eb.not(
          eb.exists(
            eb.selectFrom('liveTests')
              .select('liveTests.id')
              .whereRef('liveTests.mockTestId', '=', 'mockTests.id')
          )
        )
      )
      .where(
        db.fn("LOWER", ["exams.examName"]),
        "=",
        examName.toLowerCase()
      )
      .orderBy("mockTests.createdAt", "desc")
      .execute();

    // Bulk-fetch all mockTestItems for the fetched tests to calculate accurate counts
    const testIds = tests.map(test => test.id);

    let mockTestItemsByPackage: Map<number, { total: number; free: number }> = new Map();

    if (testIds.length > 0) {
            const mockTestItems = await db
        .selectFrom("mockTestItems")
        .select(["packageId", "isFree"])
        .where("packageId", "in", testIds)
        .where("deletedAt", "is", null)
        .execute();

      // Aggregate counts in JavaScript
      mockTestItems.forEach(item => {
        const existing = mockTestItemsByPackage.get(item.packageId) || { total: 0, free: 0 };
        existing.total += 1;
        if (item.isFree) {
          existing.free += 1;
        }
        mockTestItemsByPackage.set(item.packageId, existing);
      });
    }

    // Check enrollment status for each test if user is authenticated
    const testsWithEnrollment = await Promise.all(
      tests.map(async (test) => {
        let isEnrolled = false;
        if (userId !== null) {
          isEnrolled = await hasStudentEnrolledInMockTest(userId, test.id);
        }
        const durationMinutes = test.durationMinutes ?? 0;
        const actualQuestionCount = test.actualQuestionCount ?? 0;
        const price = parseFloat(test.price);
        const discountPrice = test.discountPrice ? parseFloat(test.discountPrice) : null;
        const rating = test.rating ? parseFloat(test.rating) : null;
        const examSlug = test.examSlug;

        // Override totalTests and freeTestsCount with computed values from mockTestItems
        const itemCounts = mockTestItemsByPackage.get(test.id) || { total: 0, free: 0 };
        const totalTests = itemCounts.total;
        const freeTestsCount = itemCounts.free;

        return {
          ...test,
          durationMinutes,
          actualQuestionCount,
          price,
          discountPrice,
          rating,
          examSlug,
          isEnrolled,
          totalTests,
          freeTestsCount,
          views: test.views ?? 0,
          teacherIsVerified: !!test.teacherIsVerified,
        };
      })
    );

    return new Response(superjson.stringify({ tests: testsWithEnrollment } satisfies OutputType));
  } catch (error) {
    console.error("Failed to fetch mock tests by exam:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch mock tests.", details: errorMessage }),
      { status: 500 }
    );
  }
}