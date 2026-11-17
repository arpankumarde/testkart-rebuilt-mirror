import { sql, type ExpressionBuilder } from "kysely";
import { db } from "../../../helpers/db";
import type { DB } from "../../../helpers/schema";
import { JOIN_WINDOW_MINUTES_AFTER } from "../../../helpers/liveLessonConfig";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./my-enrollments_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    if (user.role !== "student") {
      return new Response(superjson.stringify({ error: "Only students have group lesson enrollments." }), { status: 403 });
    }

    const url = new URL(request.url);
    const input = schema.parse({
      filter: url.searchParams.get("filter") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const filter = input.filter ?? "upcoming";
    const limit = input.limit ?? 50;
    const now = new Date();

    // Upcoming means still joinable: enrolled, lesson scheduled and not yet past the join window's end,
    // so a class that has started stays here, next to its classroom link, instead of dropping into Past.
    const stillJoinable = (
      eb: ExpressionBuilder<DB & { teacher: DB["teachers"] }, "groupLessonEnrollments" | "groupLessons" | "teacher">
    ) =>
      eb.and([
        eb("groupLessonEnrollments.status", "=", "enrolled"),
        eb("groupLessons.status", "=", "scheduled"),
        sql<boolean>`${sql.ref("groupLessons.startTime")} + (${sql.ref("groupLessons.durationMinutes")} + ${JOIN_WINDOW_MINUTES_AFTER}) * interval '1 minute' > ${now}`,
      ]);

    let query = db
      .selectFrom("groupLessonEnrollments")
      .innerJoin("groupLessons", "groupLessons.id", "groupLessonEnrollments.groupLessonId")
      .innerJoin("teachers as teacher", "teacher.id", "groupLessons.teacherId")
      .select([
        "groupLessonEnrollments.id as enrollmentId",
        "groupLessonEnrollments.status",
        "groupLessonEnrollments.amountPaid",
        "groupLessonEnrollments.removedByTeacher",
        "groupLessons.id as groupLessonId",
        "groupLessons.title",
        "groupLessons.subject",
        "groupLessons.startTime",
        "groupLessons.durationMinutes",
        "groupLessons.status as lessonStatus",
        "teacher.id as teacherId",
        "teacher.displayName as teacherName",
        "teacher.avatarUrl as teacherAvatarUrl",
      ])
      .where("groupLessonEnrollments.studentId", "=", user.id);

    if (filter === "cancelled") {
      query = query.where("groupLessonEnrollments.status", "in", ["cancelled", "removed"]);
    } else if (filter === "past") {
      query = query.where((eb) =>
        eb.or([
          eb("groupLessons.status", "in", ["completed"]),
          eb.and([eb("groupLessons.startTime", "<=", now), eb.not(stillJoinable(eb))]),
        ])
      );
    } else if (filter === "upcoming") {
      query = query.where(stillJoinable);
    }

    query = query.orderBy("groupLessons.startTime", filter === "upcoming" ? "asc" : "desc").limit(limit);

    const rows = await query.execute();

    const output: OutputType = {
      enrollments: rows.map((r) => ({
        ...r,
        status: r.status ?? "enrolled",
        amountPaid: Number(r.amountPaid ?? 0),
        removedByTeacher: !!r.removedByTeacher,
      })),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching my group lesson enrollments:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
