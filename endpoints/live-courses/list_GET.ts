import superjson from "superjson";
import { db } from "../../helpers/db";
import { liveCourseSummaryQuery, toSummaries } from "../../helpers/liveCourseData";
import { schema, type OutputType } from "./list_GET.schema";

/** Published live courses still taking enrolments, soonest start first. */
export async function handle(request: Request) {
  try {
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));
    const now = new Date();

    let examId = input.examId;
    if (!examId && input.examSlug) {
      const exam = await db.selectFrom("exams").select("id").where("examSlug", "=", input.examSlug).executeTakeFirst();
      if (!exam) return new Response(superjson.stringify({ courses: [] } satisfies OutputType));
      examId = exam.id;
    }

    let q = liveCourseSummaryQuery()
      .where("liveCourses.status", "=", "published")
      .where((eb) => eb.or([eb("liveCourses.registrationDeadline", "is", null), eb("liveCourses.registrationDeadline", ">", now)]))
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("groupLessons")
            .select("groupLessons.id")
            .whereRef("groupLessons.liveCourseId", "=", "liveCourses.id")
            .where("groupLessons.status", "=", "scheduled")
            .where("groupLessons.startTime", ">", now)
        )
      );
    if (examId) q = q.where("liveCourses.examId", "=", examId);
    if (input.teacherId) q = q.where("liveCourses.teacherId", "=", input.teacherId);
    if (input.q) q = q.where("liveCourses.title", "ilike", `%${input.q.replace(/[%_\\]/g, "\\$&")}%`);

    const rows = await q.orderBy("liveCourses.startsOn", "asc").limit(input.limit).execute();
    const output: OutputType = { courses: await toSummaries(rows) };
    return new Response(superjson.stringify(output), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    console.error("Error listing live courses:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}
