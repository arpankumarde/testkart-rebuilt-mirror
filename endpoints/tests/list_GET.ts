import { db } from "../../helpers/db";
import { sql } from "kysely";
import { OutputType } from "./list_GET.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { slugify } from "../../helpers/slugify";

export async function handle(request: Request) {
  try {
    // Try to get authenticated user session (don't fail if unauthenticated)
    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch (error) {
      // User is not authenticated, which is fine for this public endpoint
      console.log("User not authenticated, proceeding without enrollment data");
    }

    // Parse query parameters
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const examId = url.searchParams.get('examId');
    const language = url.searchParams.get('language');
    const priceType = url.searchParams.get('priceType');
    const minPrice = url.searchParams.get('minPrice');
    const maxPrice = url.searchParams.get('maxPrice');
    const sortBy = url.searchParams.get('sortBy') || 'popular';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    // Start building the query
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
        // Count actual questions from test_questions table across all test items
        // in the package. Trashed items are excluded to match the totalTests /
        // freeTestsCount counts below and the duration sum above — otherwise a
        // card advertises questions that belong to tests the teacher withdrew
        // and that the series page no longer lists.
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
      .where("mockTests.deletedAt", "is", null);

    // Exclude mock tests that are associated with live tests
    query = query.where((eb) => 
      eb.not(
        eb.exists(
          eb.selectFrom('liveTests')
            .select('liveTests.id')
            .whereRef('liveTests.mockTestId', '=', 'mockTests.id')
        )
      )
    );

    // Apply filters
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
      const languages = language.split(',').map(l => l.trim());
      query = query.where((eb) => 
        eb.or(languages.map(lang => eb("mockTests.language", "=", lang)))
      );
    }

    if (priceType === 'free') {
      query = query.where("mockTests.price", "=", "0");
    } else if (priceType === 'paid') {
      query = query.where("mockTests.price", ">", "0");
      
      if (minPrice) {
        query = query.where("mockTests.price", ">=", minPrice);
      }
      if (maxPrice) {
        query = query.where("mockTests.price", "<=", maxPrice);
      }
    }

    // Get total count before pagination
    const countQuery = query.clearSelect().select((eb) => eb.fn.countAll<number>().as('count'));
    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    // Apply sorting
    switch (sortBy) {
      case 'price_asc':
        query = query.orderBy("mockTests.price", "asc");
        break;
      case 'price_desc':
        query = query.orderBy("mockTests.price", "desc");
        break;
            case 'popular':
        query = query.orderBy(sql`(
          (SELECT COUNT(*) FROM mock_test_enrollments WHERE mock_test_id = mock_tests.id AND enrolled_at > NOW() - INTERVAL '7 days') * 3 +
          (SELECT COUNT(*) FROM mock_test_enrollments WHERE mock_test_id = mock_tests.id AND enrolled_at > NOW() - INTERVAL '30 days')
        )`, "desc").orderBy(sql`COALESCE(mock_tests.views, 0)`, "desc");
        break;
      case 'rating':
        query = query.orderBy(sql`"mock_tests"."rating" desc nulls last`);
        break;
      case 'newest':
      default:
        query = query.orderBy("mockTests.createdAt", "desc");
        break;
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);

    const tests = await query.execute();

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
    
    // Batch fetch enrollment status if user is authenticated
    let enrolledSet = new Set<number>();
    if (userId !== null && testIds.length > 0) {
      const enrollments = await db
        .selectFrom("mockTestEnrollments")
        .select("mockTestId")
        .where("studentId", "=", userId)
        .where("mockTestId", "in", testIds)
        .execute();
      
      enrollments.forEach(e => enrolledSet.add(e.mockTestId));
    }

    const testsWithEnrollment = tests.map((test) => {
        const isEnrolled = enrolledSet.has(test.id);
        const actualQuestionCount = test.actualQuestionCount ?? 0;
        const durationMinutes = test.durationMinutes ?? 0;
        const price = parseFloat(test.price);
        const discountPrice = test.discountPrice ? parseFloat(test.discountPrice) : null;
        const rating = test.rating ? parseFloat(test.rating) : null;
        
        // Override totalTests and freeTestsCount with computed values from mockTestItems
        const itemCounts = mockTestItemsByPackage.get(test.id) || { total: 0, free: 0 };
        const totalTests = itemCounts.total;
        const freeTestsCount = itemCounts.free;
        
        // Generate examSlug fallback if exam_slug is null
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
          isEnrolled,
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
    
    return new Response(superjson.stringify({ 
      tests: testsWithEnrollment,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      }
    } satisfies OutputType));
  } catch (error) {
    console.error("Failed to fetch mock tests:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch mock tests.", details: errorMessage }),
      { status: 500 }
    );
  }
}