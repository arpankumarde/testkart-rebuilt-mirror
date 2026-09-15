import { db } from "../../helpers/db";
import { OutputType } from "./details_GET.schema";
import superjson from "superjson";
import { sql } from "kysely";
import { z } from "zod";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { slugify } from "../../helpers/slugify";
import { PRODUCT_DISCLAIMER } from "../../helpers/productDisclaimer";
import { computeCourseSeo } from "../../helpers/seoIndexability";



const schema = z.object({
  slug: z.string(),
});

export async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    const validation = schema.safeParse({ slug });

    if (!validation.success) {
      return new Response(
        superjson.stringify({ error: "Invalid course slug" }),
        { status: 400 }
      );
    }

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
        "users.slug as teacherSlug"
      ])
      .where("courses.slug", "=", validation.data.slug)
      .where("courses.status", "=", "published")
      .executeTakeFirst();

    if (!course) {
      return new Response(
        superjson.stringify({ error: "Course not found or not published" }),
        { status: 404 }
      );
    }

        await db.updateTable("courses")
      .set({ views: sql`views + 1` })
      .where("id", "=", course.id)
      .execute()
      .catch((err) => {
        console.error("Failed to increment course view count:", err);
      });

    let isEnrolled = false;
    try {
      const { user } = await getServerUserSession(request);
      const enrollment = await db
        .selectFrom("courseEnrollments")
        .select("id")
        .where("courseId", "=", course.id)
        .where("studentId", "=", user.id)
        .executeTakeFirst();
      isEnrolled = !!enrollment;
    } catch (error) {
      // User is not authenticated, isEnrolled remains false
    }

    const sections = await db
      .selectFrom("courseSections")
      .selectAll()
      .where("courseId", "=", course.id)
      .orderBy("orderIndex", "asc")
      .execute();

    const lessons = await db
      .selectFrom("courseLessons")
    .select(["id", "sectionId", "title", "contentType", "durationMinutes", "isPreview", "orderIndex", "contentUrl", "textContent", "description"])
      .where("sectionId", "in", sections.map((s) => s.id))
      .orderBy("orderIndex", "asc")
      .execute();

    const videoLessons = lessons.filter((l) => l.contentType === "video").length;
    const lessonsWithDescriptionRatio =
      lessons.length > 0
        ? lessons.filter((l) => (l.description ?? "").trim().length > 0).length / lessons.length
        : 0;

    // Compute SEO indexability live from current data — see
    // helpers/seoIndexability.tsx for the full rule set and rationale.
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

    const output: OutputType = {
      ...course,
      description: course.description,
      price: Number(course.price),
      teacher: {
        id: course.teacherId,
        displayName: course.teacherDisplayName,
        profilePicture: course.teacherProfilePicture,
        isVerified: !!course.teacherIsVerified,
        slug: course.teacherSlug || slugify(course.teacherDisplayName),
        bio: course.teacherBio ?? null,
        academyName: course.teacherAcademyName ?? null,
      },
      sections: sectionsWithLessons,
      reviews,
      isEnrolled,
      disclaimer: PRODUCT_DISCLAIMER,
      seo: {
        indexable: seoResult.indexable,
        qualityScore: seoResult.qualityScore,
        robots: seoResult.robots,
      },
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching public course details:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to fetch course details", details: errorMessage }),
      { status: 500 }
    );
  }
}