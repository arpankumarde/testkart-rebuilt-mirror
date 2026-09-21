import { sql } from "kysely";
import { db } from "./db";
import { sanitizeUrl } from "./sanitizeUrl";
import type { HomepageFeaturedCourseItem } from "../endpoints/homepage/data_GET.schema";

/**
 * The homepage "Featured courses" strip, in display order. Hand-picked for now:
 * edit this list and republish to change what shows. Unpublished or unknown
 * slugs are skipped, so a course taken down drops out on its own.
 */
export const FEATURED_COURSE_SLUGS = [
  "engineering-graphics",
  "ts-and-ap-eamcet-complete-notes-with-previous-year-questions",
  "complete-vectors-for-physics-jee-main-neet",
  "basic-mathematics-for-physics-calculus-jee-neet-iat-nest",
];

export async function homepageFetchFeaturedCourses(): Promise<HomepageFeaturedCourseItem[]> {
  if (FEATURED_COURSE_SLUGS.length === 0) return [];

  const courses = await db
    .selectFrom("courses")
    .innerJoin("users", "users.id", "courses.teacherId")
    .where("courses.status", "=", "published")
    .where("courses.slug", "in", FEATURED_COURSE_SLUGS)
    .select([
      "courses.id",
      "courses.title",
      "courses.slug",
      "courses.thumbnailImageUrl as thumbnailUrl",
      "courses.price",
      "courses.examName",
      "courses.level",
      "users.displayName as teacherName",
      "users.avatarUrl as teacherAvatarUrl",
      "users.isVerified as teacherIsVerified",
      sql<number>`(SELECT COUNT(*) FROM course_lessons cl INNER JOIN course_sections cs ON cs.id = cl.section_id WHERE cs.course_id = courses.id)`.as("totalLessons"),
    ])
    .execute();

  const order = new Map(FEATURED_COURSE_SLUGS.map((slug, i) => [slug, i]));

  return courses
    .sort((a, b) => (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0))
    .map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      thumbnailUrl: sanitizeUrl(c.thumbnailUrl),
      price: Number(c.price),
      examName: c.examName && c.examName !== "Unspecified" ? c.examName : null,
      level: c.level,
      totalLessons: Number(c.totalLessons || 0),
      teacherName: c.teacherName,
      teacherAvatarUrl: sanitizeUrl(c.teacherAvatarUrl),
      teacherIsVerified: c.teacherIsVerified,
    }));
}
