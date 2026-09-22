import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import {
  REVIEW_QUEUED_NOTE,
  alreadyInReviewMessage,
  hasPendingReview,
  queueContentReview,
} from "../../../helpers/contentReviewQueue";
import { hasCourseDescription } from "../../../helpers/courseDraft";
import { schema, OutputType } from "./publish_POST.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    const { user, effectiveTeacherId, teacherRole } = await getServerUserSession(request);

    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { courseId } = schema.parse(json);

    const course = await db
      .selectFrom("courses")
      .select(["teacherId", "status", "description", "thumbnailImageUrl", "introVideoUrl"])
      .where("id", "=", courseId)
      .executeTakeFirst();

    if (!course) {
      return new Response(
        superjson.stringify({ error: "Course not found" }),
        { status: 404 }
      );
    }

    if (course.teacherId !== effectiveTeacherId && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "You do not own this course" }),
        { status: 403 }
      );
    }

    if (course.status === "published") {
      return new Response(
        superjson.stringify({ error: "Course is already published" }),
        { status: 400 }
      );
    }

    const needsReview = user.role !== "admin";
    if (needsReview && (await hasPendingReview(db, "course", courseId))) {
      return new Response(
        superjson.stringify({ error: alreadyInReviewMessage("course") }),
        { status: 400 }
      );
    }

    if (!course.thumbnailImageUrl && !course.introVideoUrl) {
      return new Response(
        superjson.stringify({
          error: "Cannot publish a course without a thumbnail image or intro video. Please add at least one.",
        }),
        { status: 400 }
      );
    }

    if (!hasCourseDescription(course.description)) {
      return new Response(
        superjson.stringify({
          error: "Add a course description before submitting it for review.",
        }),
        { status: 400 }
      );
    }

    // Validation: Ensure course has at least one lesson
    const lessonCount = await db
      .selectFrom("courseLessons")
      .innerJoin("courseSections", "courseSections.id", "courseLessons.sectionId")
      .select(db.fn.count("courseLessons.id").as("count"))
      .where("courseSections.courseId", "=", courseId)
      .executeTakeFirstOrThrow();

    if (Number(lessonCount.count) === 0) {
      return new Response(
        superjson.stringify({
          error: "Cannot publish a course with no lessons.",
        }),
        { status: 400 }
      );
    }

    if (needsReview) {
      await queueContentReview(db, { contentType: "course", contentId: courseId, teacherId: course.teacherId });
      console.log(`Course ${courseId} submitted for review by teacher ${course.teacherId}`);
      const output: OutputType = {
        success: true,
        message: `Your course has been submitted for review. ${REVIEW_QUEUED_NOTE}`,
      };
      return new Response(superjson.stringify(output));
    }

    await db
      .updateTable("courses")
      .set({
        status: "published",
        publishedAt: new Date(),
      })
      .where("id", "=", courseId)
      .execute();

    console.log(`Course ${courseId} published by admin ${user.id}`);

    const output: OutputType = {
      success: true,
      message: "Your course has been published successfully.",
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error publishing course:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      superjson.stringify({ error: "Failed to publish course", details: errorMessage }),
      { status: 500 }
    );
  }
}