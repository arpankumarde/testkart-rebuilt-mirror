import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../../helpers/db";
import { getAdminServerSessionOrThrow } from "../../../helpers/getAdminSession";
import {
  sessionsSource,
  attendeesSource,
  SWEEP_TEACHER_ABSENT_REASON,
  type SessionSqlRow,
  type AttendeeSqlRow,
} from "../../../helpers/adminLiveLessonsSql";
import { toLiveAttendee, toLiveSession } from "../../../helpers/adminLiveRows";
import { schema, OutputType, SESSION_ATTENDEES_LIMIT } from "./session_GET.schema";

/*
 * History written before session status and attendance were split used other words: the sweep's
 * "awaiting_completion" stamp (not a status change, so left out), "no_show" (missed when the
 * teacher was absent, else completed) and the sweep's teacher-absent "cancelled" (missed).
 */
const AWAITING_STAMP = "awaiting_completion";
const inSessionTerms = (status: string | null, reason: string | null) => {
  if (status === AWAITING_STAMP) return "scheduled";
  if (status === "no_show") return reason?.startsWith("Teacher") ? "missed" : "completed";
  if (status === "cancelled" && reason === SWEEP_TEACHER_ABSENT_REASON) return "missed";
  return status;
};

export async function handle(request: Request): Promise<Response> {
  try {
    await getAdminServerSessionOrThrow(request);
    const url = new URL(request.url);
    const input = schema.parse(Object.fromEntries(url.searchParams.entries()));

    const [{ rows }, { rows: attendees }, history] = await Promise.all([
      sql<SessionSqlRow>`
        WITH s AS (${sessionsSource})
        SELECT * FROM s WHERE s.kind = ${input.kind} AND s.id = ${input.id}
      `.execute(db),
      sql<AttendeeSqlRow>`
        WITH a AS (${attendeesSource})
        SELECT * FROM a
        WHERE a.type = ${input.kind} AND a.session_id = ${input.id}
        ORDER BY a.place_cancelled, a.student_name NULLS LAST, a.id
        LIMIT ${SESSION_ATTENDEES_LIMIT}
      `.execute(db),
      db
        .selectFrom("liveSessionEvents")
        .select(["id", "fromStatus", "toStatus", "actorType", "actorLabel", "reason", "createdAt"])
        .where("sessionKind", "=", input.kind)
        .where("sessionId", "=", input.id)
        .where("toStatus", "!=", AWAITING_STAMP)
        .orderBy("createdAt", "asc")
        .limit(100)
        .execute(),
    ]);
    const r = rows[0];
    if (!r) throw new Error("This session was not found.");

    const toDate = (v: Date | string | null) => (v ? new Date(v) : null);
    const output: OutputType = {
      session: {
        ...toLiveSession(r),
        missedReason: r.missedReason,
        completedAt: toDate(r.completedAt),
        completedBy: r.completedBy,
        cancelledAt: toDate(r.cancelledAt),
        cancelledBy: r.cancelledBy,
      },
      attendees: attendees.map(toLiveAttendee),
      history: history.map((h) => ({
        id: h.id,
        fromStatus: inSessionTerms(h.fromStatus, null),
        toStatus: inSessionTerms(h.toStatus, h.reason) ?? h.toStatus,
        actorType: h.actorType as "admin" | "teacher" | "learner" | "system",
        actorLabel: h.actorLabel,
        reason: h.reason,
        createdAt: new Date(h.createdAt),
      })),
    };
    return new Response(superjson.stringify(output));
  } catch (error) {
    console.error("Admin live session failed:", error);
    const message = error instanceof Error ? error.message : "Could not load this session.";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}