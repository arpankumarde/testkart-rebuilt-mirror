import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import {
  REVIEW_QUEUED_NOTE,
  alreadyInReviewMessage,
  hasPendingReview,
  publishesWithoutReview,
  queueContentReview,
} from "../../../helpers/contentReviewQueue";
import { hasCourseDescription } from "../../../helpers/courseDraft";
import { submitForReview } from "../../../helpers/teacherCampaignSubmit";
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
    const { courseId, claimCreatorBonus } = schema.parse(json);

    const course = await db
      .selectFrom("courses")
      .select(["teacherId", "status", "description", "thumbnailImageUrl", "introVideoUrl", "visibility"])
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

    // Unlisted courses skip review and go live at once (helpers/contentVisibility).
    const unlisted = course.visibility === "unlisted";
    if (unlisted && claimCreatorBonus === true) {
      return new Response(
        superjson.stringify({ error: "The Creator Bonus is for public content. Make this course public to claim it." }),
        { status: 400 }
      );
    }
    const needsReview =
      !unlisted && (claimCreatorBonus === true || !(await publishesWithoutReview(db, user.role, course.teacherId)));
    if (user.role !== "admin" && (await hasPendingReview(db, "course", courseId))) {
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
      const submitted = await submitForReview(
        { contentType: "course", contentId: courseId, teacherId: course.teacherId },
        claimCreatorBonus === true
      );
      if (!submitted.ok) {
        return new Response(superjson.stringify({ error: submitted.error }), { status: 400 });
      }
      console.log(`Course ${courseId} submitted for review by teacher ${course.teacherId}`);
      const output: OutputType = {
        success: true,
        published: false,
        message: `Your course has been submitted for review.${submitted.bonusNote} ${REVIEW_QUEUED_NOTE}`,
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

    console.log(`Course ${courseId} published without review by ${user.role} ${user.id}`);

    const output: OutputType = {
      success: true,
      published: true,
      message: unlisted
        ? "Your course is live as unlisted. Anyone with its link can open and buy it; it stays out of search and listings."
        : "Your course is live. Students can find and buy it now.",
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