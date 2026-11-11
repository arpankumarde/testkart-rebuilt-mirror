import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { ISSUE_REPORT_WINDOW_HOURS, JOIN_WINDOW_MINUTES_AFTER } from "../../../helpers/liveLessonConfig";
import { isLateForStudent } from "../../../helpers/livePackages";
import { getServerUserSession } from "../../../helpers/getServerUserSession";
import { schema, OutputType } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request) {
  try {
    const { user, effectiveTeacherId } = await getServerUserSession(request);

    const url = new URL(request.url);
    const dateParam = (name: string) => {
      const raw = url.searchParams.get(name);
      return raw ? new Date(raw) : undefined;
    };
    const input = schema.parse({
      filter: url.searchParams.get("filter") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      from: dateParam("from"),
      to: dateParam("to"),
    });
    const filter = input.filter ?? "upcoming";
    const limit = input.limit ?? 50;
    const now = new Date();

    // Upcoming means still joinable: scheduled and not yet past the join window's end, so a session
    // that has started stays here, next to its classroom link, instead of dropping into Past.
    const stillJoinable = sql<boolean>`(${sql.ref("mentorshipBookings.status")} = 'scheduled' AND ${sql.ref(
      "mentorshipBookings.scheduledAt"
    )} + (${sql.ref("mentorshipBookings.durationMinutes")} + ${JOIN_WINDOW_MINUTES_AFTER}) * interval '1 minute' > ${now})`;

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
        "mentorshipBookings.packageId",
        "mentorshipBookings.creditId",
        "mentorshipBookings.issueReportedAt",
        "mentorshipBookings.issueResolution",
        "mentorshipBookings.noShowParty",
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
          eb.and([eb("mentorshipBookings.scheduledAt", "<=", now), eb.not(stillJoinable)]),
        ])
      );
    } else if (filter === "upcoming") {
      query = query.where(stillJoinable);
    }

    if (input.from) query = query.where("mentorshipBookings.scheduledAt", ">=", input.from);
    if (input.to) query = query.where("mentorshipBookings.scheduledAt", "<", input.to);
    const windowed = !!(input.from || input.to);

    query = query
      .orderBy("mentorshipBookings.scheduledAt", filter === "upcoming" || windowed ? "asc" : "desc")
      .limit(limit);

    const rows = await query.execute();
    const reportCloses = (r: (typeof rows)[number]) =>
      new Date(r.scheduledAt).getTime() + (r.durationMinutes + ISSUE_REPORT_WINDOW_HOURS * 60) * 60000;

    const output: OutputType = {
      bookings: rows.map((r) => {
        const kind = r.packageId ? "package" : r.isTrial ? "trial" : "single";
        return {
          id: r.id,
          status: r.status ?? "scheduled",
          scheduledAt: r.scheduledAt,
          durationMinutes: r.durationMinutes,
          amountPaid: Number(r.amountPaid ?? 0),
          isTrial: !!r.isTrial,
          sessionTitle: `${kind === "trial" ? "Trial class" : kind === "package" ? "Package class" : "1:1 session"} (${r.durationMinutes} min)`,
          teacherId: r.teacherId,
          teacherName: r.teacherName,
          teacherAvatarUrl: r.teacherAvatarUrl,
          studentId: r.studentId,
          studentName: r.studentName,
          studentAvatarUrl: r.studentAvatarUrl,
          cancellationReason: r.cancellationReason,
          rescheduledFromBookingId: r.rescheduledFromBookingId,
          kind,
          packageId: r.packageId,
          freeChange: !r.creditId || !isLateForStudent(new Date(r.scheduledAt)),
          canReport:
            user.role === "student" &&
            !!r.creditId &&
            !r.issueReportedAt &&
            r.status !== "cancelled" &&
            new Date(r.scheduledAt).getTime() <= now.getTime() &&
            now.getTime() <= reportCloses(r),
          issue: r.issueReportedAt ? { reportedAt: r.issueReportedAt, resolution: r.issueResolution } : null,
          noShowParty: r.noShowParty,
        };
      }),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching mentorship bookings:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
