import superjson from "superjson";
import { sql, type RawBuilder } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  sessionsSource,
  attendeesSource,
  containsPattern,
  andAll,
  type SessionSqlRow,
  type LivePaymentStatus,
} from "../../../helpers/adminLiveLessonsSql";
import { toLiveSession } from "../../../helpers/adminLiveRows";
import { schema, OutputType } from "./bookings_GET.schema";

type ListSqlRow = SessionSqlRow & {
  amountReceived: string | number;
  paidCount: string | number;
  singlePayment: LivePaymentStatus | null;
  totalCount: string | number;
};

/*
 * Every session (1:1 and group), whatever its status, payment or date: one row per session with
 * the learner count and what was received. Learners and their attendance are in the session drawer.
 */
export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 25;

    const conds: RawBuilder<unknown>[] = [];
    if (input.from) conds.push(sql`s.start_time >= ${input.from}`);
    if (input.to) conds.push(sql`s.start_time < ${input.to}`);
    if (input.q) {
      const p = containsPattern(input.q);
      const orderIdMatch = /^\d{1,9}$/.test(input.q) ? sql` OR a.order_id = ${Number(input.q)}` : sql``;
      conds.push(sql`(s.id ILIKE ${p} OR s.title ILIKE ${p} OR s.teacher_name ILIKE ${p} OR EXISTS (
        SELECT 1 FROM a WHERE a.type = s.kind AND a.session_id = s.id
          AND (a.id ILIKE ${p} OR a.student_name ILIKE ${p} OR a.student_email ILIKE ${p}${orderIdMatch})
      ))`);
    }

    const query = (limit: RawBuilder<unknown>) => sql<ListSqlRow>`
      WITH s AS (${sessionsSource}), a AS (${attendeesSource})
      SELECT s.*, p.amount_received, p.paid_count, p.single_payment, count(*) OVER () AS total_count
      FROM s
      LEFT JOIN LATERAL (
        SELECT
          coalesce(sum(a.amount_received), 0) AS amount_received,
          count(*) FILTER (WHERE a.payment_status IN ('paid', 'credit')) AS paid_count,
          min(a.payment_status) AS single_payment
        FROM a WHERE a.type = s.kind AND a.session_id = s.id
      ) p ON TRUE
      WHERE ${andAll(conds)}
      ORDER BY s.start_time DESC, s.id
      ${limit}
    `;
    const { rows } = await query(sql`LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`).execute(db);

    let total = rows.length ? Number(rows[0].totalCount ?? 0) : 0;
    if (!rows.length && page > 1) {
      const { rows: all } = await sql<{ n: string }>`
        WITH s AS (${sessionsSource}), a AS (${attendeesSource}) SELECT count(*) AS n FROM s WHERE ${andAll(conds)}
      `.execute(db);
      total = Number(all[0]?.n ?? 0);
    }

    const output: OutputType = {
      rows: rows.map((r) => ({
        ...toLiveSession(r),
        amountReceived: Number(r.amountReceived ?? 0),
        paidCount: Number(r.paidCount ?? 0),
        paymentStatus: r.kind === "booking" ? r.singlePayment : null,
      })),
      total,
      page,
      pageSize,
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live bookings failed:", error);
    const message = error instanceof Error ? error.message : "Could not load bookings.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}