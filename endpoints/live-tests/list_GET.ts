import { db } from "../../helpers/db";
import { OutputType, LiveTestStatus } from "./list_GET.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { sql } from "kysely";
import { slugify } from "../../helpers/slugify";

function getLiveTestStatus(
  startTime: Date | null,
  endTime: Date,
  registrationDeadline: Date | null,
  maxSeats: number,
  enrolledCount: number
): LiveTestStatus {
  const now = new Date();
  
  // Check if test has ended
  if (now > endTime) return "ended";
  
  // If startTime is null, test is live as soon as we're before endTime
  // If startTime is not null, check if we're in the live window
  if (startTime === null) {
    if (now <= endTime) return "live";
  } else {
    if (now >= startTime && now <= endTime) return "live";
  }
  
  // Check if seats are full (before checking registration deadline)
  if (enrolledCount >= maxSeats) return "seats_full";
  
  // If registrationDeadline is not null, check if registration is closed
  if (registrationDeadline !== null && now > registrationDeadline) {
    return "registration_closed";
  }
  
  return "upcoming";
}

export async function handle(request: Request) {
  try {
    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch (error) {
      // User is not authenticated, which is fine for this public endpoint
    }

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const examName = url.searchParams.get("examName");
    const searchQuery = url.searchParams.get("searchQuery");
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom("liveTests")
      .innerJoin("users", "users.id", "liveTests.teacherId")
      .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
      .leftJoin("exams", "exams.examName", "mockTests.examName")
      .select([
        "liveTests.id",
        "liveTests.title",
        "liveTests.description",
        "liveTests.price",
        "liveTests.startTime",
        "liveTests.endTime",
        "liveTests.registrationDeadline",
        "liveTests.maxSeats",
        "liveTests.enrolledCount",
        "liveTests.thumbnailUrl",
        "liveTests.introVideoUrl",
        "liveTests.hasPrizes",
        "liveTests.totalPrizePool",
        "liveTests.firstPrize",
        "liveTests.secondPrize",
        "liveTests.thirdPrize",
        "liveTests.mockTestId",
        "liveTests.viewCount",
       "mockTests.examName",
        "users.displayName as teacherName",
        "users.isVerified as teacherIsVerified",
        (eb) => eb.selectFrom('mockTestItems')
          .select(sql<number>`COALESCE(SUM(duration_minutes), 0)`.as('total'))
          .whereRef('mockTestItems.packageId', '=', 'mockTests.id')
          .as('durationMinutes'),
        "mockTests.language",
        "exams.examSlug",
        // Count actual questions from test_questions table across all test items in the mock test package
        (eb) => eb.selectFrom('testQuestions')
          .select((eb) => eb.fn.countAll<number>().as('count'))
          .whereRef('testQuestions.testId', 'in', (eb) => 
            eb.selectFrom('mockTestItems')
              .select('mockTestItems.id')
              .whereRef('mockTestItems.packageId', '=', 'mockTests.id')
          )
          .as('actualQuestionCount'),
        // Aggregate subject names from test_item_subjects for the first test item
        (eb) => sql<string | null>`(
          SELECT string_agg(tis.subject_name, ', ' ORDER BY tis.order_index)
          FROM test_item_subjects tis
          WHERE tis.test_item_id = (
            SELECT mti.id 
            FROM mock_test_items mti 
            WHERE mti.package_id = ${eb.ref('mockTests.id')}
            ORDER BY mti.order_index 
            LIMIT 1
          )
        )`.as('subjects')
      ]);

    if (examName) {
      query = query.where("mockTests.examName", "ilike", `%${examName}%`);
    }

    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      query = query.where((eb) =>
        eb.or([
          eb("liveTests.title", "ilike", searchPattern),
          eb("liveTests.description", "ilike", searchPattern),
          eb("users.displayName", "ilike", searchPattern),
        ])
      );
    }

    // The status filter needs to be applied after fetching because it's calculated
    // This means we fetch all and filter in code, which is not ideal for pagination
    // but necessary for dynamic status calculation.
    // A more performant approach would use complex CASE statements in SQL.

    const allTests = await query
      .where("liveTests.isActive", "=", true)
      .orderBy("liveTests.startTime", "asc")
      .execute();

    let testsWithStatus = allTests.map((test) => ({
      ...test,
      status: getLiveTestStatus(
        test.startTime,
        test.endTime,
        test.registrationDeadline,
        test.maxSeats,
        test.enrolledCount
      ),
    }));

        if (status && status !== "all") {
      testsWithStatus = testsWithStatus.filter((test) => test.status === status);
      // For ended tests on public page, only show recently ended (60 days) with at least 1 enrollment
      if (status === "ended") {
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        testsWithStatus = testsWithStatus.filter(
          (test) => test.enrolledCount >= 1 && new Date(test.endTime) >= sixtyDaysAgo
        );
      }
    } else {
      // By default (no filter or "all"), hide ended tests to show only active/upcoming
      testsWithStatus = testsWithStatus.filter((test) => test.status !== "ended");
    }

    // Sort: live first, then upcoming, then others
    const statusOrder: Record<string, number> = { live: 0, upcoming: 1, seats_full: 2, registration_closed: 3, ended: 4 };
    testsWithStatus.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));

    const total = testsWithStatus.length;
    const paginatedTests = testsWithStatus.slice(offset, offset + limit);

    // Efficiently check hasAttempted for all paginated tests
    let attemptedMockTestIds = new Set<number>();
    
    if (userId && paginatedTests.length > 0) {
      const mockTestIds = paginatedTests.map((test) => test.mockTestId);
      
      // Get all test item IDs for these mock tests
      const testItemIds = await db
        .selectFrom("mockTestItems")
        .select("id")
        .where("packageId", "in", mockTestIds)
        .execute();
      
      const testItemIdList = testItemIds.map((item) => item.id);
      
      if (testItemIdList.length > 0) {
        // Check if user has attempted any of these test items
        const attempts = await db
          .selectFrom("testAttempts")
          .innerJoin("mockTestItems", "mockTestItems.id", "testAttempts.testId")
          .select("mockTestItems.packageId")
          .where("testAttempts.studentId", "=", userId)
          .where("testAttempts.testId", "in", testItemIdList)
          .execute();
        
        // Build a Set of mock test IDs that have been attempted
        attemptedMockTestIds = new Set(attempts.map((a) => a.packageId));
      }
    }

    const testsWithEnrollment = await Promise.all(
      paginatedTests.map(async (test) => {
        let isEnrolled = false;
        if (userId) {
          const enrollment = await db
            .selectFrom("liveTestEnrollments")
            .select("id")
            .where("studentId", "=", userId)
            .where("liveTestId", "=", test.id)
            .executeTakeFirst();
          isEnrolled = !!enrollment;
        }
        
         const hasAttempted = attemptedMockTestIds.has(test.mockTestId);
        
        // Generate examSlug with fallback - examSlug comes from SQL query
        const examSlug = test.examSlug || "general-exam";
        
        return {
          ...test,
          price: parseFloat(test.price),
          totalPrizePool: parseFloat(test.totalPrizePool),
          firstPrize: parseFloat(test.firstPrize),
          secondPrize: parseFloat(test.secondPrize),
          thirdPrize: parseFloat(test.thirdPrize),
          actualQuestionCount: test.actualQuestionCount ?? 0,
          durationMinutes: Number(test.durationMinutes) || 0,
          subjects: test.subjects,
          viewCount: test.viewCount,
          isEnrolled,
          hasAttempted,
          examSlug,
          teacherIsVerified: !!test.teacherIsVerified,
          examName: test.examName ?? null,
        };
      })
    );

    return new Response(
      superjson.stringify({
        tests: testsWithEnrollment,
        total,
        page,
        limit,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch live tests:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch live tests.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}