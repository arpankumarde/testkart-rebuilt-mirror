import { db } from "../../helpers/db";
import { OutputType } from "./details_GET.schema";
import { SocialLinks, AwardCertificate } from "../../helpers/teacherProfileTypes";
import superjson from "superjson";
import { sql } from "kysely";
import { z } from "zod";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { hasStudentEnrolledInMockTest } from "../../helpers/hasStudentEnrolledInMockTest";
import { slugify } from "../../helpers/slugify";
import { PRODUCT_DISCLAIMER } from "../../helpers/productDisclaimer";
import { computeMockTestSeo, isMeaningfulSubjectName } from "../../helpers/seoIndexability";

const inputSchema = z
  .object({
    testId: z.coerce.number().int().positive().optional(),
    slug: z.string().min(1).optional(),
  })
  .refine((data) => data.testId !== undefined || data.slug !== undefined, {
    message: "Either 'id' or 'slug' must be provided",
  });

export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const testId = url.searchParams.get("id") ?? undefined;
    const slug = url.searchParams.get("slug") ?? undefined;

    const validationResult = inputSchema.safeParse({ testId, slug });

    if (!validationResult.success) {
      return new Response(
        superjson.stringify({
          error: "Invalid parameters. Either 'id' or 'slug' must be provided.",
        }),
        { status: 400 }
      );
    }

    const { testId: validatedTestId, slug: validatedSlug } =
      validationResult.data;

    // Build the query - priority to slug if provided
    let query = db
      .selectFrom("mockTests")
      .innerJoin("users", "users.id", "mockTests.teacherId")
      .leftJoin("exams", "exams.id", "mockTests.examId")
      .selectAll("mockTests")
      .select([
        "users.displayName as teacherName",
        "users.avatarUrl as teacherAvatarUrl",
        "users.bio as teacherBio",
        "users.websiteUrl as teacherWebsiteUrl",
        "users.publicPhone as teacherPublicPhone",
        "users.publicEmail as teacherPublicEmail",
        "users.academyName as teacherAcademyName",
        "users.socialLinks as teacherSocialLinks",
        "users.awardsCertificates as teacherAwardsCertificates",
        "users.isVerified as teacherIsVerified",
        "users.slug as teacherSlug",
        "exams.examSlug as examSlug",
      ]);

    query = query.where("mockTests.deletedAt", "is", null);

    // Exclude mock tests that are actually a live test's shadow product
    // record — those are only ever meant to be reached through the live
    // test pages, not sold/browsed as a standalone normal mock test.
    query = query.where((eb) =>
      eb.not(
        eb.exists(
          eb.selectFrom('liveTests')
            .select('liveTests.id')
            .whereRef('liveTests.mockTestId', '=', 'mockTests.id')
        )
      )
    );

    if (validatedSlug) {
      query = query.where("mockTests.slug", "=", validatedSlug);
    } else if (validatedTestId) {
      query = query.where("mockTests.id", "=", validatedTestId);
    }

    const test = await query.executeTakeFirst();

    if (!test) {
      return new Response(
        superjson.stringify({ error: "Mock test not found." }),
        { status: 404 }
      );
    }

    if (!test.isPublished) {
      return new Response(
        superjson.stringify({
          error: "This mock test is not available for public viewing.",
        }),
        { status: 403 }
      );
    }

        await db.updateTable("mockTests")
      .set({ views: sql`views + 1` })
      .where("id", "=", test.id)
      .execute()
      .catch((err) => {
        console.error("Failed to increment mock test view count:", err);
      });

    // Try to get the current user session (don't fail if not authenticated)
    let isEnrolled = false;
    try {
      const { user } = await getServerUserSession(request);
      // Check if the user is enrolled in this test package
      isEnrolled = await hasStudentEnrolledInMockTest(user.id, test.id);
    } catch (error) {
      // User is not authenticated or session is invalid, treat as unauthenticated
      // isEnrolled remains false
    }

    // Query all individual test items for this package, ordered by orderIndex.
    // Trashed items are excluded — see the matching note in
    // helpers/fetchTestDetailsServer.tsx, which serves the same payload on the
    // SSR path and must stay in sync with this query.
    const items = await db
      .selectFrom("mockTestItems")
      .select([
        "id",
        "title",
        "description",
        "durationMinutes",
        "totalQuestions",
        "isFree",
        "orderIndex",
        "createdAt",
        "scheduledDate",
        "subjectWiseTiming",
        "questionWiseTiming",
      ])
      .where("packageId", "=", test.id)
      .where("deletedAt", "is", null)
      .orderBy("orderIndex", "asc")
      .execute();

    // For each test item, fetch subjects and their question counts
    const itemsWithSubjects = await Promise.all(
      items.map(async (item) => {
        const subjects = await db
          .selectFrom("testItemSubjects")
          .leftJoin(
            "testQuestions",
            "testQuestions.subjectId",
            "testItemSubjects.id"
          )
          .select([
            "testItemSubjects.id",
            "testItemSubjects.subjectName",
            "testItemSubjects.durationMinutes",
            db.fn.count("testQuestions.id").as("actualQuestionCount"),
          ])
          .where("testItemSubjects.testItemId", "=", item.id)
          .groupBy([
            "testItemSubjects.id",
            "testItemSubjects.subjectName",
            "testItemSubjects.durationMinutes",
          ])
          .orderBy("testItemSubjects.orderIndex", "asc")
          .execute();

        const subjectsWithCounts = subjects.map((subject) => ({
          id: subject.id,
          subjectName: subject.subjectName,
          actualQuestionCount: Number(subject.actualQuestionCount),
        }));

        // Calculate actual total questions by summing up all subject question counts
        const calculatedTotalQuestions = subjectsWithCounts.reduce(
          (sum, subject) => sum + subject.actualQuestionCount,
          0
        );

        // Compute effective durationMinutes based on timing mode
        let effectiveDurationMinutes: number;
        if (item.subjectWiseTiming) {
          // Sum durationMinutes from each subject's testItemSubjects row
          effectiveDurationMinutes = subjects.reduce(
            (sum, subject) => sum + (subject.durationMinutes ?? 0),
            0
          );
        } else if (item.questionWiseTiming) {
          // Sum durationSeconds from testQuestions for this item, then ceil to minutes
          const durationResult = await db
            .selectFrom("testQuestions")
            .select(db.fn.sum("testQuestions.durationSeconds").as("totalSeconds"))
            .where("testQuestions.testId", "=", item.id)
            .executeTakeFirst();
          const totalSeconds = Number(durationResult?.totalSeconds ?? 0);
          effectiveDurationMinutes = Math.ceil(totalSeconds / 60);
        } else {
          effectiveDurationMinutes = item.durationMinutes;
        }

        return {
          ...item,
         scheduledDate: item.scheduledDate,
          totalQuestions: calculatedTotalQuestions,
          durationMinutes: effectiveDurationMinutes,
          subjects: subjectsWithCounts,
        };
      })
    );

    // Generate fallback exam slug if examSlug is null
    let finalExamSlug = test.examSlug;
    if (!finalExamSlug && test.examName) {
      const fallbackSlug = slugify(test.examName);
      // If slugify results in empty string (e.g., non-ASCII chars only), use "mock-test"
      finalExamSlug = fallbackSlug || "general-exam";
    }

    // Compute SEO indexability live from current data — see
    // helpers/seoIndexability.tsx for the full rule set and rationale.
    const seoResult = await computeMockTestSeo(db, {
      id: test.id,
      title: test.title,
      description: test.description,
      longDescription: test.longDescription,
      isPublished: test.isPublished,
      deletedAt: test.deletedAt,
      examId: test.examId,
      hasSubjectTagging: itemsWithSubjects.some((item) =>
        item.subjects.some((s) => isMeaningfulSubjectName(s.subjectName))
      ),
      totalQuestions: test.totalQuestions,
      thumbnailUrl: test.thumbnailUrl,
      introVideoUrl: test.introVideoUrl,
      whatYouLearn: test.whatYouLearn,
      requirements: test.requirements,
    });

    // Kysely returns price and rating as strings, so we parse them to numbers
    // Cast JSON fields to their proper types
    const packageDetails = {
      id: test.id,
      title: test.title,
      description: test.description,
      subject: test.subject,
      price: parseFloat(test.price),
      discountPrice: test.discountPrice ? parseFloat(test.discountPrice) : null,
      examName: test.examName,
      examSlug: finalExamSlug || null,
      slug: test.slug,
      teacherName: test.teacherName,
      teacherAvatarUrl: test.teacherAvatarUrl,
      teacherId: test.teacherId,
      teacherBio: test.teacherBio,
      teacherWebsiteUrl: test.teacherWebsiteUrl,
      teacherPublicPhone: test.teacherPublicPhone,
      teacherPublicEmail: test.teacherPublicEmail,
      teacherAcademyName: test.teacherAcademyName,
      teacherSocialLinks: test.teacherSocialLinks as SocialLinks | null,
      teacherAwardsCertificates: test.teacherAwardsCertificates as
        | AwardCertificate[]
        | null,
      rating: test.rating ? parseFloat(test.rating) : null,
      studentsEnrolled: test.studentsEnrolled,
      reviewsCount: test.reviewsCount,
      totalTests: itemsWithSubjects.length,
      freeTestsCount: itemsWithSubjects.filter((i) => i.isFree).length,
      thumbnailUrl: test.thumbnailUrl,
      introVideoUrl: test.introVideoUrl || null,
      creatorName: test.creatorName,
      createdAt: test.createdAt,
      updatedAt: test.updatedAt,
      isEnrolled: isEnrolled,
      language: test.language,
      teacherSlug: test.teacherSlug || slugify(test.teacherName),
      teacherIsVerified: !!test.teacherIsVerified,
            whatYouLearn: (typeof test.whatYouLearn === 'string' ? (() => { try { return JSON.parse(test.whatYouLearn); } catch { return null; } })() : test.whatYouLearn) as string[] | null,
      requirements: (typeof test.requirements === 'string' ? (() => { try { return JSON.parse(test.requirements); } catch { return null; } })() : test.requirements) as string[] | null,
      longDescription: test.longDescription || null,
      disclaimer: PRODUCT_DISCLAIMER,
      seo: {
        indexable: seoResult.indexable,
        qualityScore: seoResult.qualityScore,
        robots: seoResult.robots,
      },
    };

    return new Response(
      superjson.stringify({
        package: packageDetails,
        items: itemsWithSubjects,
      } satisfies OutputType)
    );
  } catch (error) {
    console.error("Failed to fetch mock test details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({
        error: "Failed to fetch mock test details.",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}