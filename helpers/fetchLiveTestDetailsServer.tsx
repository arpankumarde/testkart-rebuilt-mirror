import { db } from "./db";
import type { OutputType } from "../endpoints/live-tests/details_GET.schema";
import { sql } from "kysely";
import { slugify } from "./slugify";
import type { SocialLinks, AwardCertificate } from "./teacherProfileTypes";
import { PRODUCT_DISCLAIMER } from "./productDisclaimer";

export async function fetchLiveTestDetailsServer(liveTestId: number): Promise<OutputType> {
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
    throw new Error("Live test not found.");
  }

  const firstTestItem = await db
    .selectFrom("mockTestItems")
    .select("id")
    .where("packageId", "=", liveTest.mockTestId)
    .orderBy("orderIndex", "asc")
    .executeTakeFirst();

  if (!firstTestItem) {
    throw new Error("No test items found for this live test's mock test package.");
  }

  const totalDurationResult = await db
    .selectFrom("mockTestItems")
    .select((eb) => eb.fn.sum<number>("durationMinutes").as("totalDuration"))
    .where("packageId", "=", liveTest.mockTestId)
    .executeTakeFirst();

  const totalDurationMinutes = Number(totalDurationResult?.totalDuration ?? 0);

  const totalQuestionsResult = await db
    .selectFrom("testQuestions")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("testQuestions.testId", "in", (eb) =>
      eb.selectFrom("mockTestItems")
        .select("mockTestItems.id")
        .where("mockTestItems.packageId", "=", liveTest.mockTestId)
    )
    .executeTakeFirst();

  const totalQuestions = totalQuestionsResult?.count ?? 0;

  const subjectData = await db
    .selectFrom("testItemSubjects as tis")
    .where("tis.testItemId", "=", firstTestItem.id)
    .select((eb) =>
      sql<string | null>`string_agg(${eb.ref('tis.subjectName')}, ', ' ORDER BY ${eb.ref('tis.orderIndex')})`.as('aggregatedSubject')
    )
    .executeTakeFirst();

  const aggregatedSubject = subjectData?.aggregatedSubject || null;

  const examSlug = liveTest.examSlug || (liveTest.mockTestExamName ? slugify(liveTest.mockTestExamName) : null) || "general-exam";

  return {
    ...liveTest,
    description: liveTest.description,
    price: parseFloat(liveTest.price as string),
    totalPrizePool: parseFloat(liveTest.totalPrizePool as string),
    firstPrize: parseFloat(liveTest.firstPrize as string),
    secondPrize: parseFloat(liveTest.secondPrize as string),
    thirdPrize: parseFloat(liveTest.thirdPrize as string),
    isEnrolled: false,
    canEnroll: false,
    hasAttempted: false,
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
}