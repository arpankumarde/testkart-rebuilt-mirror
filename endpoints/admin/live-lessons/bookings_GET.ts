import superjson from "superjson";
import { sql, type RawBuilder } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  bookingsHistorySource,
  paymentStatusExpr,
  amountReceivedExpr,
  containsPattern,
  andAll,
  type BookingSqlRow,
} from "../../../helpers/adminLiveLessonsSql";
import { toLiveBookingRow } from "../../../helpers/adminLiveBookingRow";
import { schema, OutputType } from "./bookings_GET.schema";

/*
 * Every booking in every lifecycle status, plus group lessons cancelled before anyone enrolled.
 * "removed" is a group learner taken off by the teacher and counts as cancelled. Nothing is left
 * out for its payment, session date or cancellation date.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 25;

    const conds: RawBuilder<unknown>[] = [];
    if (input.status === "cancelled") conds.push(sql`b.status IN ('cancelled', 'removed')`);
    else if (input.status === "overdue") conds.push(sql`b.overdue`);
    else if (input.status) conds.push(sql`b.status = ${input.status}`);
    if (input.type) conds.push(sql`b.type = ${input.type}`);
    if (input.payment) conds.push(sql`(${paymentStatusExpr}) = ${input.payment}`);
    if (input.teacherId) conds.push(sql`b.teacher_id = ${input.teacherId}`);
    if (input.sessionId) conds.push(sql`b.session_id = ${input.sessionId}`);
    if (input.from) conds.push(sql`b.session_start >= ${input.from}`);
    if (input.to) conds.push(sql`b.session_start < ${input.to}`);
    if (input.q) {
      const p = containsPattern(input.q);
      const orderIdMatch = /^\d{1,9}$/.test(input.q) ? sql` OR b.order_id = ${Number(input.q)}` : sql``;
      conds.push(
        sql`(b.id ILIKE ${p} OR b.session_id ILIKE ${p} OR b.student_name ILIKE ${p} OR b.student_email ILIKE ${p}
          OR b.teacher_name ILIKE ${p} OR b.session_title ILIKE ${p}${orderIdMatch})`
      );
    }

    const orderBy =
      input.sort === "booked"
        ? sql`b.booked_at DESC NULLS LAST, b.id`
        : sql`b.session_start DESC, b.id`;

    const [list, summary] = await Promise.all([
      sql<BookingSqlRow>`
        WITH b AS (${bookingsHistorySource})
        SELECT b.*, ${paymentStatusExpr} AS payment_status, ${amountReceivedExpr} AS amount_received, count(*) OVER () AS total_count
        FROM b
        WHERE ${andAll(conds)}
        ORDER BY ${orderBy}
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `.execute(db),
      sql<Record<"total" | "scheduled" | "awaiting" | "overdue" | "completed" | "cancelled" | "noShow", string>>`
        WITH b AS (${bookingsHistorySource})
        SELECT
          count(*) AS total,
          count(*) FILTER (WHERE b.status = 'scheduled') AS scheduled,
          count(*) FILTER (WHERE b.status = 'awaiting_completion') AS awaiting,
          count(*) FILTER (WHERE b.overdue) AS overdue,
          count(*) FILTER (WHERE b.status = 'completed') AS completed,
          count(*) FILTER (WHERE b.status IN ('cancelled', 'removed')) AS cancelled,
          count(*) FILTER (WHERE b.status = 'no_show') AS no_show
        FROM b
      `.execute(db),
    ]);

    let total = list.rows.length ? Number(list.rows[0].totalCount ?? 0) : 0;
    if (!list.rows.length && page > 1) {
      const { rows } = await sql<{ n: string }>`
        WITH b AS (${bookingsHistorySource}) SELECT count(*) AS n FROM b WHERE ${andAll(conds)}
      `.execute(db);
      total = Number(rows[0]?.n ?? 0);
    }
    const s = summary.rows[0];
    const output: OutputType = {
      rows: list.rows.map(toLiveBookingRow),
      total,
      page,
      pageSize,
      summary: {
        total: Number(s?.total ?? 0),
        scheduled: Number(s?.scheduled ?? 0),
        awaitingCompletion: Number(s?.awaiting ?? 0),
        overdue: Number(s?.overdue ?? 0),
        completed: Number(s?.completed ?? 0),
        cancelled: Number(s?.cancelled ?? 0),
        noShow: Number(s?.noShow ?? 0),
      },
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live bookings failed:", error);
    const message = error instanceof Error ? error.message : "Could not load bookings.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}