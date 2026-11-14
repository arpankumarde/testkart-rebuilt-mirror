import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import {
  LiveCourseError,
  assertApprovedLiveTeacher,
  errorResponse,
  getManagedCourse,
} from "../../../helpers/liveCourseServer";
import { liveCourseMinClasses } from "../../../helpers/liveCourseRules";
import { schema, type OutputType } from "./publish_POST.schema";

/**
 * Publishing puts the course on sale at once; there is no admin review for live courses. It also
 * fixes the course's min classes (90% of the classes planned then), which sets the teacher's pay
 * per class; classes added later do not change it.
 */
export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const course = await getManagedCourse(input.liveCourseId, user, effectiveTeacherId);

    if (input.action === "unpublish") {
      if (course.status !== "published") throw new LiveCourseError("This live course is not published.");
      if (course.enrolledCount > 0) {
        throw new LiveCourseError("Students have already enrolled, so this course cannot go back to draft.");
      }
      await db.updateTable("liveCourses").set({ status: "draft", updatedAt: new Date() }).where("id", "=", course.id).execute();
      const output: OutputType = { status: "draft", slug: course.slug };
      return new Response(superjson.stringify(output));
    }

    if (course.status !== "draft") throw new LiveCourseError(`A ${course.status} live course cannot be published.`);
    await assertApprovedLiveTeacher(user, course.teacherId);

    const missing: string[] = [];
    if (course.description.trim().length < 50) missing.push("a description of at least 50 characters");
    if (Number(course.price) <= 0) missing.push("a price");
    if (!course.registrationDeadline) missing.push("a registration deadline");
    else if (new Date(course.registrationDeadline).getTime() <= Date.now()) missing.push("a registration deadline that has not passed");
    const upcoming = await db
      .selectFrom("groupLessons")
      .select("id")
      .where("liveCourseId", "=", course.id)
      .where("status", "=", "scheduled")
      .where("startTime", ">", new Date())
      .executeTakeFirst();
    if (!upcoming) missing.push("at least one upcoming class");
    if (missing.length) throw new LiveCourseError(`Before publishing, add ${missing.join(", ")}.`);

    const planned = await db
      .selectFrom("groupLessons")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .where("liveCourseId", "=", course.id)
      .where("status", "!=", "cancelled")
      .executeTakeFirst();
    await db
      .updateTable("liveCourses")
      .set({
        status: "published",
        publishedAt: course.publishedAt ?? new Date(),
        minClasses: liveCourseMinClasses(Number(planned?.n ?? 0)),
        updatedAt: new Date(),
      })
      .where("id", "=", course.id)
      .execute();
    const output: OutputType = { status: "published", slug: course.slug };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error publishing live course:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
