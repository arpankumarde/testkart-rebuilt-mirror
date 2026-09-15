import { sql } from "kysely";
import { db } from "./db";
import { sanitizeUrl } from "./sanitizeUrl";
import { HomepageCourseItem } from "../endpoints/homepage/data_GET.schema";

export async function homepageFetchPopularCourses(): Promise<HomepageCourseItem[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const courses = await db
    .selectFrom("courses")
    .innerJoin("users", "users.id", "courses.teacherId")
    .where("courses.status", "=", "published")
    .select((eb) => [
      "courses.id",
      "courses.title",
      "courses.slug",
      "courses.thumbnailImageUrl as thumbnailUrl",
      "courses.price",
      "courses.rating",
      "courses.views",
      "users.displayName as teacherName",
      "users.slug as teacherSlug",
      "users.avatarUrl as teacherAvatarUrl",
      "users.tagline as teacherTagline",
      "users.yearsOfExperience as teacherYearsOfExperience",
      "users.isVerified as teacherIsVerified",
      eb
        .selectFrom("courseEnrollments")
        .select(eb.fn.count<number>("id").as("count"))
        .whereRef("courseId", "=", "courses.id")
        .as("studentsEnrolled"),
      eb
        .selectFrom("courseEnrollments")
        .select(eb.fn.count<number>("id").as("count"))
        .whereRef("courseId", "=", "courses.id")
        .where("enrolledAt", ">", thirtyDaysAgo)
        .as("recentEnrollments"),
      sql<number>`(SELECT COUNT(*) FROM course_lessons cl INNER JOIN course_sections cs ON cs.id = cl.section_id WHERE cs.course_id = courses.id)`.as("totalLessons"),
    ])
    .orderBy("recentEnrollments", "desc")
    .limit(8)
    .execute();

  return courses.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
   thumbnailUrl: sanitizeUrl((c as any).thumbnailUrl),
    price: Number(c.price),
    studentsEnrolled: Number(c.studentsEnrolled || 0),
    rating: c.rating != null ? Number(c.rating) : null,
    totalLessons: Number(c.totalLessons || 0),
    teacherName: c.teacherName,
    teacherSlug: c.teacherSlug,
    teacherAvatarUrl: sanitizeUrl(c.teacherAvatarUrl),
    teacherTagline: c.teacherTagline,
    teacherYearsOfExperience: c.teacherYearsOfExperience,
    teacherIsVerified: c.teacherIsVerified,
   views: Number((c as any).views ?? 0),
  }));
}