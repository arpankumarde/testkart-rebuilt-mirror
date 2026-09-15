import { db } from "../../helpers/db";
import { OutputType, TestListItem, LiveTestListItem, CourseListItem, ShopProductListItem } from "./profile_GET.schema";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { hasStudentEnrolledInMockTest } from "../../helpers/hasStudentEnrolledInMockTest";
import { slugify } from "../../helpers/slugify";
import { sql } from "kysely";
import { SocialLinks, AwardCertificate, WorkExperience } from "../../helpers/teacherProfileTypes";
import { getLiveTestStatus } from "../../helpers/liveTestStatus";

export async function handle(request: Request) {
  const url = new URL(request.url);
  const teacherSlug = url.searchParams.get("teacherSlug");

  if (!teacherSlug) {
    return new Response(
      superjson.stringify({ error: "teacherSlug is required" }),
      { status: 400 }
    );
  }

  try {
    // Look up teacher directly by the slug column
    const teacher = await db
      .selectFrom("users")
      .selectAll()
      .where("role", "=", "teacher")
      .where("isActive", "=", true)
      .where("slug", "=", teacherSlug)
      .executeTakeFirst();

    if (!teacher) {
      return new Response(
        superjson.stringify({ error: "Teacher not found" }),
        { status: 404 }
      );
    }

    console.log(`Found teacher with ID ${teacher.id} for slug '${teacherSlug}'`);

    // Try to get authenticated user session (don't fail if unauthenticated)
    let userId: number | null = null;
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
    } catch (error) {
      // User is not authenticated, which is fine for this public endpoint
      console.log("User not authenticated, proceeding without enrollment data");
    }

    // Fetch work experiences for the teacher
    const workExperiences = await db
      .selectFrom("teacherWorkExperiences")
      .selectAll()
      .where("teacherId", "=", teacher.id)
      .orderBy("startDate", "desc")
      .execute();

    const workExperiencesData: WorkExperience[] = workExperiences.map((we) => ({
      id: we.id,
      companyName: we.companyName,
      position: we.position,
      startDate: we.startDate,
      endDate: we.endDate,
      isCurrent: we.isCurrent ?? false,
      description: we.description,
      location: we.location,
    }));

    // Fetch all published courses
    const courses = await db
      .selectFrom("courses")
      .innerJoin("users", "users.id", "courses.teacherId")
      .select([
        "courses.id",
        "courses.slug",
        "courses.title",
        "courses.description",
        "courses.thumbnailUrl",
        "courses.thumbnailImageUrl",
        "courses.price",
        "courses.category",
        "courses.level",
        "courses.language",
        "courses.status",
        "courses.publishedAt",
        "courses.views",
        "courses.introVideoUrl",
        "courses.examId",
        "courses.examName",
        "users.displayName as teacherName",
        "users.slug as teacherSlugCol",
        "users.isVerified as teacherIsVerifiedCol",
        "users.avatarUrl as teacherAvatarUrl",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
      ])
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM course_enrollments
          WHERE course_enrollments.course_id = courses.id
        )`.as("enrollmentCount"),
        sql<number | null>`(
          SELECT AVG(r.rating)
          FROM reviews r
          WHERE r.course_id = courses.id
        )`.as("avgRating"),
        sql<number>`(
          SELECT COUNT(*)
          FROM reviews r
          WHERE r.course_id = courses.id
        )`.as("ratingsCount"),
      ])
      .where("courses.status", "=", "published")
      .where("courses.teacherId", "=", teacher.id)
      .orderBy("courses.createdAt", "desc")
      .execute();

    const coursesData: CourseListItem[] = courses.map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      thumbnailUrl: course.thumbnailUrl,
      thumbnailImageUrl: course.thumbnailImageUrl,
      price: Number(course.price),
      category: course.category,
      level: course.level,
      language: course.language,
      status: course.status,
      publishedAt: course.publishedAt,
      views: Number(course.views ?? 0),
      introVideoUrl: course.introVideoUrl,
      examId: course.examId,
      examName: course.examName,
      teacherName: course.teacherName,
      teacherSlug: course.teacherSlugCol ?? slugify(course.teacherName),
      teacherIsVerified: !!(course.teacherIsVerifiedCol),
      teacherAvatarUrl: course.teacherAvatarUrl ?? null,
      teacherTagline: course.teacherTagline ?? null,
      teacherYearsOfExperience: course.teacherYearsOfExperience ?? null,
      enrollmentCount: Number(course.enrollmentCount),
      avgRating: course.avgRating !== null && course.avgRating !== undefined ? Number(course.avgRating) : null,
      ratingsCount: Number(course.ratingsCount),
    }));

    // Fetch all published digital products
    const products = await db
      .selectFrom("digitalProducts")
      .innerJoin("users", "users.id", "digitalProducts.teacherId")
      .select([
        "digitalProducts.id",
        "digitalProducts.title",
        "digitalProducts.slug",
        "digitalProducts.thumbnailUrl",
        "digitalProducts.category",
        "digitalProducts.examName",
        "digitalProducts.pageCount",
        "digitalProducts.price",
        "digitalProducts.rating",
        "digitalProducts.totalPurchases",
        "digitalProducts.publishedAt",
        "digitalProducts.views",
        "users.displayName as teacherName",
        "users.avatarUrl as teacherAvatar",
        "users.slug as teacherSlugCol",
        "users.isVerified as teacherIsVerifiedCol",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
      ])
      .select((eb) => [
        sql<number>`(
          SELECT COUNT(*)
          FROM reviews r
          WHERE r.digital_product_id = digital_products.id
        )`.as("ratingsCount"),
        sql<number>`(
          SELECT COUNT(*)
          FROM digital_product_files f
          WHERE f.product_id = digital_products.id
        )`.as("fileCount"),
      ])
      .where("digitalProducts.status", "=", "published")
      .where("digitalProducts.teacherId", "=", teacher.id)
      .orderBy("digitalProducts.createdAt", "desc")
      .execute();

    const productsData: ShopProductListItem[] = products.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      thumbnailUrl: p.thumbnailUrl,
      category: p.category,
      examName: p.examName ?? null,
      pageCount: p.pageCount ?? null,
      price: Number(p.price),
      rating: p.rating ? Number(p.rating) : null,
      totalPurchases: p.totalPurchases ?? 0,
      publishedAt: p.publishedAt,
      views: Number(p.views ?? 0),
      teacherName: p.teacherName,
      teacherAvatar: p.teacherAvatar,
      teacherSlug: p.teacherSlugCol ?? slugify(p.teacherName),
      teacherIsVerified: !!(p.teacherIsVerifiedCol),
      teacherTagline: p.teacherTagline ?? null,
      teacherYearsOfExperience: p.teacherYearsOfExperience ?? null,
      ratingsCount: Number(p.ratingsCount),
      fileCount: Number(p.fileCount ?? 0),
    }));

    // Fetch all published tests
    const tests = await db
      .selectFrom("mockTests")
      .innerJoin("users", "users.id", "mockTests.teacherId")
      .leftJoin("exams", "exams.id", "mockTests.examId")
      .leftJoin("liveTests", (join) =>
        join
          .onRef("liveTests.mockTestId", "=", "mockTests.id")
          .on("liveTests.isActive", "=", true)
      )
      .select([
        "mockTests.id",
        "mockTests.slug",
        "mockTests.title",
        "mockTests.description",
        "mockTests.subject",
        "mockTests.price",
        "mockTests.discountPrice",
        "mockTests.totalQuestions",
        // Calculate total duration by summing all test items' durations
        (eb) => eb.selectFrom('mockTestItems')
          .select((eb) => eb.fn.coalesce(
            eb.fn.sum<number>('mockTestItems.durationMinutes'),
            eb.val<number>(0)
          ).as('totalDuration'))
          .whereRef('mockTestItems.packageId', '=', 'mockTests.id')
          .as('durationMinutes'),
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
        "users.slug as teacherSlugCol",
        "users.avatarUrl as teacherAvatarUrl",
        "users.tagline as teacherTagline",
        "users.yearsOfExperience as teacherYearsOfExperience",
        "exams.examSlug",
        "liveTests.id as liveTestId",
        "liveTests.startTime",
        "liveTests.endTime",
        "liveTests.registrationDeadline",
        "liveTests.maxSeats",
        "liveTests.enrolledCount",
        "liveTests.hasPrizes",
        "liveTests.totalPrizePool",
        "liveTests.firstPrize",
        "liveTests.secondPrize",
        "liveTests.thirdPrize",
        "liveTests.viewCount",
        // Count actual questions from test_questions table across all test items in the package
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
      ])
      .where("mockTests.isPublished", "=", true)
      .where("mockTests.deletedAt", "is", null)
      .where("mockTests.teacherId", "=", teacher.id)
      .orderBy("mockTests.createdAt", "desc")
      .execute();

    // Separate regular tests and live tests
    const regularTests: TestListItem[] = [];
    const liveTestsData: LiveTestListItem[] = [];

    for (const test of tests) {
      const isLiveTest = test.liveTestId !== null;

      // Normalize aggregated columns
      const durationMinutes = Number(test.durationMinutes ?? 0);
      const actualQuestionCount = Number(test.actualQuestionCount ?? 0);

      if (isLiveTest) {
        // This is a live test
        const status = getLiveTestStatus({
          startTime: test.startTime!,
          endTime: test.endTime!,
          registrationDeadline: test.registrationDeadline!,
          maxSeats: test.maxSeats!,
          enrolledCount: test.enrolledCount!
        });

        // Check if user is enrolled in this live test
        let isEnrolled = false;
        if (userId !== null) {
          const enrollment = await db
            .selectFrom("liveTestEnrollments")
            .select("id")
            .where("studentId", "=", userId)
            .where("liveTestId", "=", test.liveTestId!)
            .executeTakeFirst();
          isEnrolled = !!enrollment;
        }

        // Check if user has attempted this live test
        let hasAttempted = false;
        if (userId !== null) {
          const testItemIds = await db
            .selectFrom("mockTestItems")
            .select("id")
            .where("packageId", "=", test.id)
            .execute();

          const testItemIdList = testItemIds.map((item) => item.id);

          if (testItemIdList.length > 0) {
            const attempt = await db
              .selectFrom("testAttempts")
              .select("id")
              .where("studentId", "=", userId)
              .where("testId", "in", testItemIdList)
              .executeTakeFirst();
            hasAttempted = !!attempt;
          }
        }

        // Generate examSlug with fallback
        const liveTestExamSlug = test.examSlug || (test.examName ? slugify(test.examName) : null) || "general-exam";

        liveTestsData.push({
          id: test.liveTestId!,
          title: test.title,
          description: test.description,
          examName: test.examName,
          price: parseFloat(test.price),
          startTime: test.startTime!,
          endTime: test.endTime!,
          registrationDeadline: test.registrationDeadline!,
          maxSeats: test.maxSeats!,
          enrolledCount: test.enrolledCount!,
          thumbnailUrl: test.thumbnailUrl,
          introVideoUrl: test.introVideoUrl,
          hasPrizes: test.hasPrizes!,
          totalPrizePool: parseFloat(test.totalPrizePool!),
          firstPrize: parseFloat(test.firstPrize!),
          secondPrize: parseFloat(test.secondPrize!),
          thirdPrize: parseFloat(test.thirdPrize!),
          teacherName: test.teacherName,
          teacherIsVerified: !!teacher.isVerified,
          isEnrolled,
          hasAttempted,
          status,
          durationMinutes,
          language: test.language,
          actualQuestionCount,
          subjects: test.subjects ?? null,
          examSlug: liveTestExamSlug,
          viewCount: test.viewCount ?? 0,
        });
      } else {
        // This is a regular test
        let isEnrolled = false;
        if (userId !== null) {
          isEnrolled = await hasStudentEnrolledInMockTest(userId, test.id);
        }

        // Generate examSlug with fallback
        const regularTestExamSlug = test.examSlug || (test.examName ? slugify(test.examName) : null) || "general-exam";

        regularTests.push({
          id: test.id,
          slug: test.slug,
          title: test.title,
          description: test.description,
          subject: test.subject,
          price: parseFloat(test.price),
          discountPrice: test.discountPrice ? parseFloat(test.discountPrice) : null,
          rating: test.rating ? parseFloat(test.rating) : null,
          durationMinutes,
          totalQuestions: test.totalQuestions,
          thumbnailUrl: test.thumbnailUrl,
          introVideoUrl: test.introVideoUrl,
          totalTests: test.totalTests,
          freeTestsCount: test.freeTestsCount,
          creatorName: test.creatorName,
          studentsEnrolled: test.studentsEnrolled,
          reviewsCount: test.reviewsCount,
          examName: test.examName,
          language: test.language,
          teacherName: test.teacherName,
          teacherSlug: test.teacherSlugCol ?? null,
          teacherAvatarUrl: test.teacherAvatarUrl ?? null,
          teacherTagline: test.teacherTagline ?? null,
          teacherYearsOfExperience: test.teacherYearsOfExperience ?? null,
          teacherIsVerified: !!teacher.isVerified,
          actualQuestionCount,
          isEnrolled,
          examSlug: regularTestExamSlug,
          views: test.views ?? 0,
        });
      }
    }

    const response: OutputType = {
      teacher: {
        id: teacher.id,
        displayName: teacher.displayName,
        slug: teacher.slug,
        avatarUrl: teacher.avatarUrl,
        bio: teacher.bio,
        websiteUrl: teacher.websiteUrl,
        // mobileNumber, publicEmail and publicPhone are deliberately NOT sent.
        // This is a public, unauthenticated endpoint, so anything returned here
        // is readable by anyone who opens the network tab - hiding a teacher's
        // contact details in the markup alone would not actually hide them.
        // The mobile app declares these three in its own interface but never
        // renders them (testkart-app src/app/(main)/expert/[slug].tsx),
        // so dropping them breaks nothing at runtime.
        socialLinks: teacher.socialLinks as unknown as SocialLinks | null,
        awardsCertificates: teacher.awardsCertificates as unknown as AwardCertificate[] | null,
        languages: teacher.languages as unknown as string[] | null,
        location: teacher.location,
        expertiseAreas: teacher.expertiseAreas as unknown as string[] | null,
        responseTime: teacher.responseTime,
        tagline: teacher.tagline,
        isVerified: !!teacher.isVerified,
        workExperiences: workExperiencesData,
        academyName: teacher.academyName,
        yearsOfExperience: teacher.yearsOfExperience,
        joinedAt: teacher.createdAt,
      },
      courses: coursesData,
      tests: regularTests,
      liveTests: liveTestsData,
      products: productsData,
    };

    return new Response(superjson.stringify(response));
  } catch (error) {
    console.error("Failed to fetch teacher profile:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch teacher profile.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}