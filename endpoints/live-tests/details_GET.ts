import { db } from "../../helpers/db";
import { OutputType } from "./details_GET.schema";
import superjson from "superjson";
import { z } from "zod";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { SocialLinks, AwardCertificate } from "../../helpers/teacherProfileTypes";
import { sql } from "kysely";
import { slugify } from "../../helpers/slugify";
import { PRODUCT_DISCLAIMER } from "../../helpers/productDisclaimer";



const inputSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    const validationResult = inputSchema.safeParse({ id });
    if (!validationResult.success) {
      return new Response(
        superjson.stringify({ error: "A valid live test ID is required." }),
        { status: 400 }
      );
    }

    const liveTestId = validationResult.data.id;

    const liveTest = await db
      .selectFrom("liveTests")
      .innerJoin("users", "users.id", "liveTests.teacherId")
      .innerJoin("mockTests", "mockTests.id", "liveTests.mockTestId")
      .leftJoin("exams", "exams.examName", "mockTests.examName")
      .where("liveTests.id", "=", liveTestId)
      .where("liveTests.isActive", "=", true)
      .selectAll("liveTests")
      .select([
        "users.displayName as teacherName",
        "users.avatarUrl as teacherAvatarUrl",
        "users.bio as teacherBio",
        "users.websiteUrl as teacherWebsiteUrl",
        "users.socialLinks as teacherSocialLinks",
        "users.awardsCertificates as teacherAwardsCertificates",
        "users.publicPhone as teacherPublicPhone",
        "users.publicEmail as teacherPublicEmail",
        "users.academyName as teacherAcademyName",
        "users.isVerified as teacherIsVerified",
        "users.slug as teacherSlugCol",
        "mockTests.title as mockTestTitle",
        "mockTests.description as mockTestDescription",
        "mockTests.durationMinutes as mockTestDurationMinutes",
        "mockTests.examName as mockTestExamName",
        "mockTests.slug as mockTestSlug",
        "exams.examSlug",
      ])
      .executeTakeFirst();

    if (!liveTest) {
      return new Response(
        superjson.stringify({ error: "Live test not found." }),
        { status: 404 }
      );
    }

        await db.updateTable("liveTests")
      .set({ viewCount: sql`view_count + 1` })
      .where("id", "=", liveTestId)
      .execute()
      .catch((err) => console.error("Failed to increment live test view count:", err));

    let isEnrolled = false;
    let hasAttempted = false;
    let userId: number | null = null;
    
    try {
      const { user } = await getServerUserSession(request);
      userId = user.id;
      const enrollment = await db
        .selectFrom("liveTestEnrollments")
        .select("id")
        .where("studentId", "=", user.id)
        .where("liveTestId", "=", liveTestId)
        .executeTakeFirst();
      isEnrolled = !!enrollment;
    } catch (error) {
      // User not authenticated
    }

    // Check if user has attempted any test items from this live test's mock test
    if (userId !== null) {
      const testItemIds = await db
        .selectFrom("mockTestItems")
        .select("id")
        .where("packageId", "=", liveTest.mockTestId)
        .execute();
      
      if (testItemIds.length > 0) {
        const attempt = await db
          .selectFrom("testAttempts")
          .select("id")
          .where("studentId", "=", userId)
          .where("testId", "in", testItemIds.map(item => item.id))
          .executeTakeFirst();
        
        hasAttempted = !!attempt;
      }
    }

    // Fetch the first test item from the mock test package
    const firstTestItem = await db
      .selectFrom("mockTestItems")
      .select("id")
      .where("packageId", "=", liveTest.mockTestId)
      .orderBy("orderIndex", "asc")
      .executeTakeFirst();

    if (!firstTestItem) {
      return new Response(
        superjson.stringify({ 
          error: "No test items found for this live test's mock test package." 
        }),
        { status: 404 }
      );
    }

    // Calculate total duration by summing durationMinutes from all mock test items in the package
    const totalDurationResult = await db
      .selectFrom("mockTestItems")
      .select((eb) => eb.fn.sum<number>("durationMinutes").as("totalDuration"))
      .where("packageId", "=", liveTest.mockTestId)
      .executeTakeFirst();

    const totalDurationMinutes = Number(totalDurationResult?.totalDuration ?? 0);

    // Count actual questions from test_questions table
    const totalQuestionsResult = await db
      .selectFrom('testQuestions')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('testQuestions.testId', 'in', (eb) => 
        eb.selectFrom('mockTestItems')
          .select('mockTestItems.id')
          .where('mockTestItems.packageId', '=', liveTest.mockTestId)
      )
      .executeTakeFirst();

    const totalQuestions = totalQuestionsResult?.count ?? 0;

    // Fetch subject names aggregated as comma-separated string
    const subjectData = await db
      .selectFrom("testItemSubjects as tis")
      .where("tis.testItemId", "=", firstTestItem.id)
      .select((eb) => 
        sql<string | null>`string_agg(${eb.ref('tis.subjectName')}, ', ' ORDER BY ${eb.ref('tis.orderIndex')})`.as('aggregatedSubject')
      )
      .executeTakeFirst();

    const aggregatedSubject = subjectData?.aggregatedSubject || null;

    const now = new Date();
        // If registrationDeadline is set, use it; otherwise allow enrollment until test ends
    const enrollmentCutoff = liveTest.registrationDeadline ?? liveTest.endTime;
    const canEnroll =
      !isEnrolled &&
      now < enrollmentCutoff &&
      liveTest.enrolledCount < liveTest.maxSeats &&
      now < liveTest.endTime;

    // Generate examSlug with fallback
    const examSlug = liveTest.examSlug || (liveTest.mockTestExamName ? slugify(liveTest.mockTestExamName) : null) || "general-exam";

        const responseData: OutputType = {
      ...liveTest,
      description: liveTest.description,
      price: parseFloat(liveTest.price),
      totalPrizePool: parseFloat(liveTest.totalPrizePool),
      firstPrize: parseFloat(liveTest.firstPrize),
      secondPrize: parseFloat(liveTest.secondPrize),
      thirdPrize: parseFloat(liveTest.thirdPrize),
      isEnrolled,
      canEnroll,
      hasAttempted,
      examSlug,
      slug: liveTest.mockTestSlug,
            teacherIsVerified: !!liveTest.teacherIsVerified,
      teacherSlug: liveTest.teacherSlugCol || slugify(liveTest.teacherName),
      teacherProfile: {
        id: liveTest.teacherId,
        name: liveTest.teacherName,
        avatarUrl: liveTest.teacherAvatarUrl,
        bio: liveTest.teacherBio,
        websiteUrl: liveTest.teacherWebsiteUrl,
        socialLinks: liveTest.teacherSocialLinks as SocialLinks | null,
        awardsCertificates: liveTest.teacherAwardsCertificates as AwardCertificate[] | null,
        publicPhone: liveTest.teacherPublicPhone,
        publicEmail: liveTest.teacherPublicEmail,
        academyName: liveTest.teacherAcademyName,
      },
      mockTestDetails: {
        id: liveTest.mockTestId,
        title: liveTest.mockTestTitle,
        description: liveTest.mockTestDescription,
        examName: liveTest.mockTestExamName ?? null,
        durationMinutes: totalDurationMinutes,
        totalQuestions: Number(totalQuestions),
        subject: aggregatedSubject,
        firstTestItemId: firstTestItem.id,
      },
      disclaimer: PRODUCT_DISCLAIMER,
    };

    return new Response(superjson.stringify(responseData));
  } catch (error) {
    console.error("Failed to fetch live test details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch live test details.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}