import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { getSignedDownloadUrl } from "../../../helpers/r2Client";
import { extractR2Key } from "../../../helpers/extractR2Key";
import { schema, OutputType } from "./signed-video-url_POST.schema";
import superjson from "superjson";

const EXPIRATION_SECONDS = 1800; // 30 minutes

export async function handle(request: Request): Promise<Response> {
  try {
    const { user } = await getServerUserSession(request);

    if (user.role !== "student" && user.role !== "admin") {
      return new Response(
        superjson.stringify({ error: "Unauthorized access" }),
        { status: 403 }
      );
    }

    const json = superjson.parse(await request.text());
    const { courseId, lessonId, videoUrl } = schema.parse(json);

    const lesson = await db
      .selectFrom("courseLessons")
      .innerJoin(
        "courseSections",
        "courseSections.id",
        "courseLessons.sectionId"
      )
      .select(["courseSections.courseId", "courseLessons.contentUrl"])
      .where("courseLessons.id", "=", lessonId)
      .executeTakeFirst();

    if (!lesson) {
      return new Response(
        superjson.stringify({ error: "Lesson not found" }),
        { status: 404 }
      );
    }

    if (lesson.courseId !== courseId) {
      return new Response(
        superjson.stringify({ error: "Lesson does not belong to this course" }),
        { status: 400 }
      );
    }

    if (lesson.contentUrl !== videoUrl) {
      console.warn(
        `Video URL mismatch for lesson ${lessonId}. Provided: ${videoUrl}, Expected: ${lesson.contentUrl}`
      );
      return new Response(
        superjson.stringify({ error: "Video URL mismatch" }),
        { status: 400 }
      );
    }

    // For YouTube URLs, return the raw URL directly without ImageKit signing
    const isYouTubeUrl = videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');
    if (isYouTubeUrl) {
      console.log(`Lesson ${lessonId} is a YouTube video, returning raw URL without signing.`);
      const output: OutputType = {
        signedUrl: videoUrl,
        expiresIn: 0,
      };
      return new Response(superjson.stringify(output));
    }

    // Admins can bypass the enrollment check
    if (user.role === "student") {
      const enrollment = await db
        .selectFrom("courseEnrollments")
        .select("id")
        .where("courseId", "=", courseId)
        .where("studentId", "=", user.id)
        .executeTakeFirst();

      if (!enrollment) {
        return new Response(
          superjson.stringify({ error: "Not enrolled in this course" }),
          { status: 403 }
        );
      }
    }

    const r2Key = extractR2Key(videoUrl);
    const signedUrl = await getSignedDownloadUrl(r2Key, EXPIRATION_SECONDS);

    const output: OutputType = {
      signedUrl,
      expiresIn: EXPIRATION_SECONDS,
    };

    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Failed to generate signed video URL:", error);
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    if (error instanceof Error && error.name === "NotAuthenticatedError") {
      return new Response(
        superjson.stringify({ error: "Not authenticated" }),
        { status: 401 }
      );
    }
    return new Response(
      superjson.stringify({
        error: "Failed to generate signed URL",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}