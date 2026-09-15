import { db } from "./db";
import { sql } from "kysely";
import type { OutputType } from "../endpoints/tests/details_GET.schema";
import type { SocialLinks, AwardCertificate } from "./teacherProfileTypes";
import { slugify } from "./slugify";
import { PRODUCT_DISCLAIMER } from "./productDisclaimer";
import { computeMockTestSeo, isMeaningfulSubjectName } from "./seoIndexability";

export async function fetchTestDetailsServer(slug: string): Promise<OutputType> {
  const test = await db
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
      "users.slug as teacherSlugCol",
      "exams.examSlug as examSlug",
    ])
    .where("mockTests.slug", "=", slug)
    .where("mockTests.deletedAt", "is", null)
    // Exclude mock tests that are actually a live test's shadow product
    // record — only reachable through the live test pages, never sold as a
    // standalone normal mock test. Keep in sync with tests/details_GET.ts.
    .where((eb) =>
      eb.not(
        eb.exists(
          eb.selectFrom('liveTests')
            .select('liveTests.id')
            .whereRef('liveTests.mockTestId', '=', 'mockTests.id')
        )
      )
    )
    .executeTakeFirst();

  if (!test) {
    throw new Error("Mock test not found.");
  }

  if (!test.isPublished) {
    throw new Error("This mock test is not available for public viewing.");
  }

  // This helper backs the SSR/prefetch path (pages/mock-test.$testSlug.prefetch.ts),
  // which is how the vast majority of real page loads reach this data — the
  // client-side query hook rarely re-fetches tests/details_GET.ts once the
  // SSR result hydrates its cache as fresh. Increment views here too so the
  // counter reflects real traffic instead of only direct API cache-misses.
  db.updateTable("mockTests")
    .set({ views: sql`views + 1` })
    .where("id", "=", test.id)
    .execute()
    .catch((err) => {
      console.error("Failed to increment mock test view count (SSR):", err);
    });

  // Query all individual test items for this package, ordered by orderIndex.
  // Trashed items are excluded: a teacher who deletes a test expects it gone
  // from the sales page, and the package's own totalTests/totalQuestions
  // aggregates already exclude them (see syncMockTestAggregates), so leaving
  // them in here would also make the list disagree with the counts beside it.
  // Keep in sync with tests/details_GET.ts.
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
      "subjectWiseTiming",
      "questionWiseTiming",
      "scheduledDate",
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
  // helpers/seoIndexability.tsx for the full rule set and rationale. Kept in
  // sync with tests/details_GET.ts, which the client falls back to.
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

  const packageDetails = {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    price: parseFloat(test.price as string),
    discountPrice: test.discountPrice ? parseFloat(test.discountPrice as string) : null,
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
    rating: test.rating ? parseFloat(test.rating as string) : null,
    studentsEnrolled: test.studentsEnrolled,
    reviewsCount: test.reviewsCount,
    totalTests: itemsWithSubjects.length,
    freeTestsCount: itemsWithSubjects.filter((i) => i.isFree).length,
    thumbnailUrl: test.thumbnailUrl,
    introVideoUrl: test.introVideoUrl || null,
    creatorName: test.creatorName,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
    isEnrolled: false,
    language: test.language,
    teacherIsVerified: !!test.teacherIsVerified,
    teacherSlug: test.teacherSlugCol || slugify(test.teacherName),
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

  return {
    package: packageDetails,
    items: itemsWithSubjects,
  };
}