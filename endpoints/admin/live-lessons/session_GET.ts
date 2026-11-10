import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  sessionsSource,
  bookingsSource,
  paymentStatusExpr,
  amountReceivedExpr,
  approvedTeacherOnly,
  type SessionSqlRow,
  type BookingSqlRow,
} from "../../../helpers/adminLiveLessonsSql";
import { toLiveBookingRow } from "../../../helpers/adminLiveBookingRow";
import { schema, OutputType, SESSION_BOOKINGS_LIMIT } from "./session_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));

    const { rows } = await sql<SessionSqlRow>`
      WITH s AS (${sessionsSource})
      SELECT * FROM s WHERE s.kind = ${input.kind} AND s.id = ${input.id} AND ${approvedTeacherOnly}
    `.execute(db);
    const r = rows[0];
    if (!r) throw new Error("This session was not found, or its teacher is not approved for live teaching.");

    const extra =
      input.kind === "group"
        ? await db
            .selectFrom("groupLessons")
            .select(["description", "subject", "level", "language", "minEnrollment", "createdAt"])
            .where("id", "=", input.id)
            .executeTakeFirst()
        : null;
    const booking =
      input.kind === "booking"
        ? await db
            .selectFrom("mentorshipBookings")
            .select(["meetingLink", "createdAt"])
            .where("id", "=", input.id)
            .executeTakeFirst()
        : null;

    const { rows: bookingRows } = await sql<BookingSqlRow>`
      WITH b AS (${bookingsSource})
      SELECT b.*, ${paymentStatusExpr} AS payment_status, ${amountReceivedExpr} AS amount_received, count(*) OVER () AS total_count
      FROM b
      WHERE b.type = ${input.kind} AND b.session_id = ${input.id}
      ORDER BY b.booked_at DESC NULLS LAST, b.id
      LIMIT ${SESSION_BOOKINGS_LIMIT}
    `.execute(db);

    const start = new Date(r.startTime);
    const output: OutputType = {
      session: {
        kind: r.kind,
        id: r.id,
        title: r.title,
        teacherId: r.teacherId,
        teacherName: r.teacherName,
        teacherAvatarUrl: r.teacherAvatarUrl,
        studentName: r.studentName,
        start,
        end: new Date(start.getTime() + r.durationMinutes * 60000),
        durationMinutes: r.durationMinutes,
        status: r.status,
        enrolledCount: r.enrolledCount,
        maxCapacity: r.maxCapacity,
        price: Number(r.price ?? 0),
        isTrial: !!r.isTrial,
        cancellationReason: r.cancellationReason,
        description: extra?.description ?? null,
        subject: extra?.subject ?? null,
        level: extra?.level ?? null,
        language: extra?.language ?? null,
        minEnrollment: extra?.minEnrollment ?? null,
        hasMeetingLink: !!booking?.meetingLink,
        createdAt: extra?.createdAt ? new Date(extra.createdAt) : booking?.createdAt ? new Date(booking.createdAt) : null,
      },
      bookings: bookingRows.map(toLiveBookingRow),
      bookingsTotal: bookingRows.length ? Number(bookingRows[0].totalCount ?? 0) : 0,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live session failed:", error);
    const message = error instanceof Error ? error.message : "Could not load this session.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}