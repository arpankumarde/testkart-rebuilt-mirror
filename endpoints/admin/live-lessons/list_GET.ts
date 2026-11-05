import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType, AdminLiveLessonRow } from "./list_GET.schema";
import superjson from "superjson";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);

    const url = new URL(request.url);
    const input = schema.parse({
      filter: url.searchParams.get("filter") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });
    const filter = input.filter ?? "upcoming";
    const limit = input.limit ?? 100;
    const now = new Date();

    const bookingsQuery = db
      .selectFrom("mentorshipBookings")
      .innerJoin("users as teacher", "teacher.id", "mentorshipBookings.teacherId")
      .innerJoin("users as student", "student.id", "mentorshipBookings.studentId")
      .select([
        "mentorshipBookings.id",
        "mentorshipBookings.scheduledAt",
        "mentorshipBookings.durationMinutes",
        "mentorshipBookings.status",
        "mentorshipBookings.amountPaid",
        "mentorshipBookings.cancellationReason",
        "mentorshipBookings.createdAt",
        "mentorshipBookings.teacherId",
        "mentorshipBookings.studentId",
        "teacher.displayName as teacherName",
        "student.displayName as studentName",
      ]);

    const groupQuery = db
      .selectFrom("groupLessons")
      .innerJoin("users as teacher", "teacher.id", "groupLessons.teacherId")
      .select([
        "groupLessons.id",
        "groupLessons.title",
        "groupLessons.startTime",
        "groupLessons.durationMinutes",
        "groupLessons.status",
        "groupLessons.pricePerLearner",
        "groupLessons.enrolledCount",
        "groupLessons.maxCapacity",
        "groupLessons.cancellationReason",
        "groupLessons.createdAt",
        "groupLessons.teacherId",
        "teacher.displayName as teacherName",
      ]);

    const [bookings, groups] = await Promise.all([bookingsQuery.execute(), groupQuery.execute()]);

    let rows: AdminLiveLessonRow[] = [
      ...bookings.map((b) => ({
        kind: "booking" as const,
        id: b.id,
        title: `1:1 session with ${b.studentName ?? "a learner"}`,
        teacherId: b.teacherId,
        teacherName: b.teacherName,
        startTime: b.scheduledAt,
        durationMinutes: b.durationMinutes,
        status: b.status ?? "scheduled",
        studentId: b.studentId,
        studentName: b.studentName,
        enrolledCount: null,
        maxCapacity: null,
        price: Number(b.amountPaid ?? 0),
        cancellationReason: b.cancellationReason,
        createdAt: b.createdAt ?? b.scheduledAt,
      })),
      ...groups.map((g) => ({
        kind: "group" as const,
        id: g.id,
        title: g.title,
        teacherId: g.teacherId,
        teacherName: g.teacherName,
        startTime: g.startTime,
        durationMinutes: g.durationMinutes,
        status: g.status,
        studentId: null,
        studentName: null,
        enrolledCount: g.enrolledCount,
        maxCapacity: g.maxCapacity,
        price: Number(g.pricePerLearner ?? 0),
        cancellationReason: g.cancellationReason,
        createdAt: g.createdAt ?? g.startTime,
      })),
    ];

    rows = rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "cancelled") return r.status === "cancelled";
      if (filter === "past") return r.status === "completed" || r.status === "no_show" || (r.status !== "cancelled" && r.startTime <= now);
      // upcoming
      return r.status !== "cancelled" && r.status !== "completed" && r.status !== "no_show" && r.startTime > now;
    });

    rows.sort((a, b) =>
      filter === "upcoming" ? a.startTime.getTime() - b.startTime.getTime() : b.startTime.getTime() - a.startTime.getTime()
    );
    rows = rows.slice(0, limit);

    const output: OutputType = { rows };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Error fetching admin live lessons list:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(superjson.stringify({ error: errorMessage }), { status: 400 });
  }
}
