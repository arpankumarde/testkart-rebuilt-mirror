import { sql, type ExpressionBuilder } from "kysely";
import { db } from "../../../helpers/db";
import type { DB } from "../../../helpers/schema";
import { JOIN_WINDOW_MINUTES_AFTER } from "../../../helpers/liveLessonConfig";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    const url = new URL(request.url);
    const input = schema.parse({
      filter: url.searchParams.get("filter") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    const filter = input.filter ?? "upcoming";
    const limit = input.limit ?? 50;
    const now = new Date();

    // Upcoming means still joinable: scheduled and not yet past the join window's end, so a session
    // that has started stays here, next to its classroom link, instead of dropping into Past.
    const stillJoinable = (eb: ExpressionBuilder<DB, "mentorshipBookings">) =>
      eb.and([
        eb("mentorshipBookings.status", "=", "scheduled"),
        sql<boolean>`${sql.ref("mentorshipBookings.scheduledAt")} + (${sql.ref("mentorshipBookings.durationMinutes")} + ${JOIN_WINDOW_MINUTES_AFTER}) * interval '1 minute' > ${now}`,
      ]);

    let query = db
      .selectFrom("mentorshipBookings")
      .innerJoin("users as teacher", "teacher.id", "mentorshipBookings.teacherId")
      .innerJoin("users as student", "student.id", "mentorshipBookings.studentId")
      .select([
        "mentorshipBookings.id",
        "mentorshipBookings.status",
        "mentorshipBookings.scheduledAt",
        "mentorshipBookings.durationMinutes",
        "mentorshipBookings.amountPaid",
        "mentorshipBookings.isTrial",
        "mentorshipBookings.cancellationReason",
        "mentorshipBookings.rescheduledFromBookingId",
        "teacher.id as teacherId",
        "teacher.displayName as teacherName",
        "teacher.avatarUrl as teacherAvatarUrl",
        "student.id as studentId",
        "student.displayName as studentName",
        "student.avatarUrl as studentAvatarUrl",
      ]);

    if (user.role === "teacher") {
      query = query.where("mentorshipBookings.teacherId", "=", effectiveTeacherId);
    } else if (user.role === "student") {
      query = query.where("mentorshipBookings.studentId", "=", user.id);
    } else if (user.role !== "admin") {
      return new Response(superjson.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    if (filter === "cancelled") {
      query = query.where("mentorshipBookings.status", "=", "cancelled");
    } else if (filter === "past") {
      query = query.where((eb) =>
        eb.or([
          eb("mentorshipBookings.status", "in", ["completed", "no_show"]),
          eb.and([eb("mentorshipBookings.scheduledAt", "<=", now), eb.not(stillJoinable(eb))]),
        ])
      );
    } else if (filter === "upcoming") {
      query = query.where(stillJoinable);
    }

    query = query.orderBy("mentorshipBookings.scheduledAt", filter === "upcoming" ? "asc" : "desc").limit(limit);

    const rows = await query.execute();

    const output: OutputType = {
      bookings: rows.map((r) => ({
        ...r,
        status: r.status ?? "scheduled",
        amountPaid: Number(r.amountPaid ?? 0),
        isTrial: !!r.isTrial,
        sessionTitle: `${r.isTrial ? "Trial " : ""}1:1 session (${r.durationMinutes} min)`,
      })),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching mentorship bookings:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
