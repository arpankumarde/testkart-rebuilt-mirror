import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import {
  LiveCourseError,
  assertApprovedLiveTeacher,
  errorResponse,
  getManagedCourse,
  uniqueLiveCourseSlug,
} from "../../../helpers/liveCourseServer";
import { priceChangeActor, setPriceChangeActor } from "../../../helpers/productPriceHistoryServer";
import { schema, type OutputType } from "./upsert_POST.schema";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId, teacherRole, impersonatorAdminId, session } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));

    let examName: string | null = null;
    if (input.examId) {
      const exam = await db.selectFrom("exams").select("examName").where("id", "=", input.examId).executeTakeFirst();
      if (!exam) throw new LiveCourseError("That exam was not found.");
      examName = exam.examName;
    }

    const fields = {
      title: input.title,
      description: input.description,
      thumbnailUrl: input.thumbnailUrl ?? null,
      thumbnailFileId: input.thumbnailFileId ?? null,
      examId: input.examId ?? null,
      examName,
      languages: input.languages,
      level: input.level,
      price: input.price.toFixed(2),
      originalPrice: input.originalPrice == null ? null : input.originalPrice.toFixed(2),
      seatLimit: input.seatLimit,
      registrationDeadline: input.registrationDeadline ?? null,
      defaultClassMinutes: input.defaultClassMinutes,
      updatedAt: new Date(),
    };

    if (input.id) {
      const course = await getManagedCourse(input.id, user, effectiveTeacherId);
      if (course.status === "cancelled" || course.status === "completed") {
        throw new LiveCourseError(`A ${course.status} live course cannot be edited.`);
      }
      if (input.seatLimit < course.enrolledCount) {
        throw new LiveCourseError(`Seats cannot go below the ${course.enrolledCount} students already enrolled.`);
      }
      // The slug follows the title only until the course is first published, so shared links keep working.
      const slug =
        course.publishedAt === null && course.title !== input.title
          ? await uniqueLiveCourseSlug(input.title, course.id)
          : course.slug;
      // One transaction so the price history trigger records who made the change.
      await db.transaction().execute(async (trx) => {
        await setPriceChangeActor(trx, priceChangeActor({ user, teacherRole, impersonatorAdminId, session }));
        await trx.updateTable("liveCourses").set({ ...fields, slug }).where("id", "=", course.id).execute();
      });
      const output: OutputType = { id: course.id, slug };
      return new Response(superjson.stringify(output));
    }

    await assertApprovedLiveTeacher(user, effectiveTeacherId);
    const slug = await uniqueLiveCourseSlug(input.title);
    const inserted = await db
      .insertInto("liveCourses")
      .values({ ...fields, slug, teacherId: effectiveTeacherId, status: "draft" })
      .returning("id")
      .executeTakeFirstOrThrow();
    const output: OutputType = { id: inserted.id, slug };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error saving live course:", error);
    const { status, message } = errorResponse(error);
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
