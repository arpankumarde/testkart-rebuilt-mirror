import { db } from "./db";
import { sql } from "kysely";
import type { OutputType } from "../endpoints/courses/details_GET.schema";
import { slugify } from "./slugify";
import { PRODUCT_DISCLAIMER } from "./productDisclaimer";
import { computeCourseSeo } from "./seoIndexability";

export async function fetchCourseDetailsServer(slug: string): Promise<OutputType> {
  const course = await db
    .selectFrom("courses")
    .innerJoin("users", "users.id", "courses.teacherId")
    .selectAll("courses")
    .select([
      "users.id as teacherId",
      "users.displayName as teacherDisplayName",
      "users.avatarUrl as teacherProfilePicture",
      "users.isVerified as teacherIsVerified",
      "users.bio as teacherBio",
      "users.academyName as teacherAcademyName",
      "users.slug as teacherSlugCol",
    ])
    .where("courses.slug", "=", slug)
    .where("courses.status", "=", "published")
    .executeTakeFirst();

  if (!course) {
    throw new Error("Course not found or not published");
  }

  // This helper backs the SSR/prefetch path (pages/course.$courseSlug.prefetch.ts),
  // which is how the vast majority of real page loads reach this data — the
  // client-side query hook rarely re-fetches courses/details_GET.ts once the
  // SSR result hydrates its cache as fresh. Increment views here too so the
  // counter reflects real traffic instead of only direct API cache-misses.
  db.updateTable("courses")
    .set({ views: sql`views + 1` })
    .where("id", "=", course.id)
    .execute()
    .catch((err) => {
      console.error("Failed to increment course view count (SSR):", err);
    });

  const sections = await db
    .selectFrom("courseSections")
    .selectAll()
    .where("courseId", "=", course.id)
    .orderBy("orderIndex", "asc")
    .execute();

  const sectionIds = sections.length > 0 ? sections.map((s) => s.id) : [-1];

  const lessons = await db
    .selectFrom("courseLessons")
    .select(["id", "sectionId", "title", "contentType", "durationMinutes", "isPreview", "orderIndex", "contentUrl", "textContent", "description"])
    .where("sectionId", "in", sectionIds)
    .orderBy("orderIndex", "asc")
    .execute();

  const videoLessons = lessons.filter((l) => l.contentType === "video").length;
  const lessonsWithDescriptionRatio =
    lessons.length > 0
      ? lessons.filter((l) => (l.description ?? "").trim().length > 0).length / lessons.length
      : 0;

  // Compute SEO indexability live from current data — see
  // helpers/seoIndexability.tsx for the full rule set and rationale. Kept
  // in sync with courses/details_GET.ts, which the client falls back to.
  const seoResult = await computeCourseSeo(db, {
    id: course.id,
    title: course.title,
    description: course.description,
    status: course.status,
    examId: course.examId,
    category: course.category,
    totalLessons: lessons.length,
    videoLessons,
    lessonsWithDescriptionRatio,
    thumbnailUrl: course.thumbnailUrl,
    introVideoUrl: course.introVideoUrl,
    estimatedDurationMinutes: course.estimatedDurationMinutes,
  });

  const reviews = await db
    .selectFrom("reviews")
    .innerJoin("users", "reviews.userId", "users.id")
    .select([
      "reviews.id",
      "reviews.rating",
      "reviews.reviewText",
      "reviews.createdAt",
      "reviews.userId",
      "users.displayName as reviewerName",
      "users.avatarUrl as reviewerAvatarUrl",
    ])
    .where("reviews.courseId", "=", course.id)
    .orderBy("reviews.createdAt", "desc")
    .execute();

  const sectionsWithLessons = sections.map((section) => ({
    ...section,
    lessons: lessons
      .filter((lesson) => lesson.sectionId === section.id)
      .map((lesson) => {
        // Only include contentUrl and textContent for preview lessons
        if (lesson.isPreview) {
          return lesson;
        } else {
          const { contentUrl, textContent, ...lessonWithoutContent } = lesson;
          return lessonWithoutContent;
        }
      }),
  }));

  return {
    ...course,
    description: course.description,
    price: Number(course.price),
    teacher: {
      id: course.teacherId,
      displayName: course.teacherDisplayName,
      profilePicture: course.teacherProfilePicture,
            isVerified: !!course.teacherIsVerified,
      slug: course.teacherSlugCol || slugify(course.teacherDisplayName),
            bio: course.teacherBio ?? null,
      academyName: course.teacherAcademyName ?? null,
    },
    sections: sectionsWithLessons,
    reviews,
    isEnrolled: false,
    disclaimer: PRODUCT_DISCLAIMER,
    seo: {
      indexable: seoResult.indexable,
      qualityScore: seoResult.qualityScore,
      robots: seoResult.robots,
    },
  };
}