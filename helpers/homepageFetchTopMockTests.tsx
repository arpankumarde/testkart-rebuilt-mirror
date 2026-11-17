import { sql } from "kysely";
import { db } from "./db";
import { sanitizeUrl } from "./sanitizeUrl";
import { HomepageTestItem } from "../endpoints/homepage/data_GET.schema";
import { mockTestShownPriceSql } from "./paidFirst";

/** The homepage's "Top mock tests this week": paid series only, most enrolments in the last 7 days first. */
export async function homepageFetchTopMockTests(): Promise<HomepageTestItem[]> {
  const tests = await db
    .selectFrom("mockTests")
    .innerJoin("teachers", "teachers.id", "mockTests.teacherId")
    .where("mockTests.isPublished", "=", true)
    .where("mockTests.visibility", "=", "public")
    .where("mockTests.deletedAt", "is", null)
    .where(mockTestShownPriceSql, ">", sql<string>`0`)
    .where(({ not, exists, selectFrom }) =>
      not(
        exists(
          selectFrom("liveTests")
            .select("liveTests.id")
            .whereRef("liveTests.mockTestId", "=", "mockTests.id")
        )
      )
    )
    .select((eb) => [
      "mockTests.id",
      "mockTests.title",
      "mockTests.slug",
      "mockTests.thumbnailUrl",
      "mockTests.examName",
      "mockTests.totalTests",
      "mockTests.price",
      "mockTests.discountPrice",
      "mockTests.studentsEnrolled",
      "mockTests.rating",
      "mockTests.reviewsCount",
      "mockTests.views",
      "teachers.displayName as teacherName",
      "teachers.slug as teacherSlug",
      "teachers.avatarUrl as teacherAvatarUrl",
      "teachers.tagline as teacherTagline",
      "teachers.yearsOfExperience as teacherYearsOfExperience",
      "teachers.isVerified as teacherIsVerified",
      sql<number>`(SELECT COUNT(*) FROM mock_test_enrollments WHERE mock_test_id = mock_tests.id AND enrolled_at > NOW() - INTERVAL '7 days')`.as("recentEnrollments"),
    ])
    .orderBy("recentEnrollments", "desc")
    .orderBy("mockTests.studentsEnrolled", "desc")
    .limit(8)
    .execute();

  return tests.map((t) => ({
    id: t.id,
    title: t.title,
    slug: t.slug,
   thumbnailUrl: sanitizeUrl(t.thumbnailUrl),
    examName: t.examName,
    totalTests: Number(t.totalTests || 0),
    price: Number(t.price),
    discountPrice: t.discountPrice != null ? Number(t.discountPrice) : null,
    studentsEnrolled: Number(t.studentsEnrolled || 0),
    rating: t.rating != null ? Number(t.rating) : null,
    reviewsCount: Number(t.reviewsCount || 0),
    teacherName: t.teacherName,
    teacherSlug: t.teacherSlug,
    teacherAvatarUrl: sanitizeUrl(t.teacherAvatarUrl),
    teacherTagline: t.teacherTagline,
    teacherYearsOfExperience: t.teacherYearsOfExperience,
    teacherIsVerified: Boolean(t.teacherIsVerified),
   views: Number(t.views ?? 0),
  }));
}