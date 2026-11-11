import superjson from "superjson";
import { sql, type RawBuilder } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  sessionsSource,
  SESSION_KINDS,
  approvedTeacherOnly,
  containsPattern,
  andAll,
  type SessionSqlRow,
} from "../../../helpers/adminLiveLessonsSql";
import { toLiveSession } from "../../../helpers/adminLiveRows";
import { schema, OutputType, CALENDAR_EVENT_LIMIT } from "./calendar_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));

    const kinds = (input.kinds ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter((k): k is (typeof SESSION_KINDS)[number] => (SESSION_KINDS as readonly string[]).includes(k));

    const conds: RawBuilder<unknown>[] = [
      approvedTeacherOnly,
      sql`s.start_time < ${input.to}`,
      sql`s.start_time + make_interval(mins => s.duration_minutes) > ${input.from}`,
    ];
    if (kinds.length === 1) conds.push(sql`s.kind = ${kinds[0]}`);
    if (input.status) conds.push(sql`s.status = ${input.status}`);
    if (input.teacherId) conds.push(sql`s.teacher_id = ${input.teacherId}`);
    if (input.q) {
      const p = containsPattern(input.q);
      conds.push(sql`(s.title ILIKE ${p} OR s.teacher_name ILIKE ${p} OR s.student_name ILIKE ${p} OR s.id ILIKE ${p})`);
    }

    const { rows } = await sql<SessionSqlRow>`
      WITH s AS (${sessionsSource})
      SELECT * FROM s
      WHERE ${andAll(conds)}
      ORDER BY s.start_time, s.id
      LIMIT ${CALENDAR_EVENT_LIMIT + 1}
    `.execute(db);

    const truncated = rows.length > CALENDAR_EVENT_LIMIT;
    const output: OutputType = { truncated, events: rows.slice(0, CALENDAR_EVENT_LIMIT).map(toLiveSession) };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live calendar failed:", error);
    const message = error instanceof Error ? error.message : "Could not load the calendar.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}