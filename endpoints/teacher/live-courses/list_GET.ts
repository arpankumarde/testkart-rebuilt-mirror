import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { liveCourseSummaryQuery, toSummaries } from "../../../helpers/liveCourseData";
import type { OutputType } from "./list_GET.schema";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);
    if (user.role !== "teacher" && user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    const [rows, teacher, next] = await Promise.all([
      liveCourseSummaryQuery()
        .where("liveCourses.teacherId", "=", effectiveTeacherId)
        .orderBy("liveCourses.createdAt", "desc")
        .execute(),
      db.selectFrom("users").select("liveTeachingStatus").where("id", "=", effectiveTeacherId).executeTakeFirst(),
      db
        .selectFrom("groupLessons")
        .select(["liveCourseId", db.fn.min("startTime").as("nextAt")])
        .where("teacherId", "=", effectiveTeacherId)
        .where("liveCourseId", "is not", null)
        .where("status", "=", "scheduled")
        .where("startTime", ">", new Date())
        .groupBy("liveCourseId")
        .execute(),
    ]);
    const nextBy = new Map(next.map((n) => [n.liveCourseId as string, n.nextAt as Date]));
    const summaries = await toSummaries(rows);

    const output: OutputType = {
      courses: summaries.map((s) => ({ ...s, nextClassAt: nextBy.get(s.id) ?? null })),
      canCreate: user.role === "admin" || teacher?.liveTeachingStatus === "approved",
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error listing teacher live courses:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 400 });
  }
}
