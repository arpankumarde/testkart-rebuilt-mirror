import superjson from "superjson";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import { schema, OutputType, LiveIssueRow } from "./issues_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const { status } = schema.parse({ status: url.searchParams.get("status") ?? undefined });

    let q = db
      .selectFrom("mentorshipBookings")
      .innerJoin("liveClassCredits", "liveClassCredits.id", "mentorshipBookings.creditId")
      .innerJoin("students as student", "student.id", "mentorshipBookings.studentId")
      .innerJoin("teachers as teacher", "teacher.id", "mentorshipBookings.teacherId")
      .select([
        "mentorshipBookings.id",
        "mentorshipBookings.scheduledAt",
        "mentorshipBookings.durationMinutes",
        "mentorshipBookings.issueNote",
        "mentorshipBookings.issueReportedAt",
        "mentorshipBookings.issueResolution",
        "mentorshipBookings.issueResolvedAt",
        "mentorshipBookings.studentId",
        "mentorshipBookings.teacherId",
        "liveClassCredits.amount",
        "liveClassCredits.kind",
        "student.displayName as studentName",
        "teacher.displayName as teacherName",
      ])
      .where("mentorshipBookings.issueReportedAt", "is not", null);
    q = (status ?? "open") === "open" ? q.where("mentorshipBookings.issueResolution", "is", null) : q.where("mentorshipBookings.issueResolution", "is not", null);
    const rows = await q.orderBy("mentorshipBookings.issueReportedAt", "desc").limit(200).execute();

    const attendance = rows.length
      ? await db
          .selectFrom("liveLessonAttendance")
          .select(["mentorshipBookingId", "userId"])
          .where("mentorshipBookingId", "in", rows.map((r) => r.id))
          .execute()
      : [];

    const issues: LiveIssueRow[] = rows.map((r) => ({
      bookingId: r.id,
      scheduledAt: r.scheduledAt,
      durationMinutes: r.durationMinutes,
      amount: Number(r.amount),
      kind: r.kind as "trial" | "package",
      studentId: r.studentId,
      studentName: r.studentName,
      teacherId: r.teacherId,
      teacherName: r.teacherName,
      note: r.issueNote,
      reportedAt: r.issueReportedAt as Date,
      teacherJoined: attendance.some((a) => a.mentorshipBookingId === r.id && a.userId === r.teacherId),
      studentJoined: attendance.some((a) => a.mentorshipBookingId === r.id && a.userId === r.studentId),
      resolution: r.issueResolution as LiveIssueRow["resolution"],
      resolvedAt: r.issueResolvedAt,
    }));
    const output: OutputType = { issues };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live issues failed:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Could not load reports." }), { status: 400 });
  }
}
