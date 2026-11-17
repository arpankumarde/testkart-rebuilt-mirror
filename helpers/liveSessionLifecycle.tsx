import type { Kysely } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { returnCredit, spendCredit } from "./livePackages";
import { sendClassRefundedEmail } from "./livePackageEmails";
import { SWEEP_TEACHER_ABSENT_REASON } from "./adminLiveLessonsSql";

/*
 * Server-only lifecycle of a live session (a 1:1 booking or a group lesson) and of each learner's
 * attendance. The two are kept apart: a teacher can hold a group lesson that some learners miss.
 *
 * Session status as admins see it: scheduled | completed | missed (the teacher did not hold it) |
 * cancelled. Stored values stay as they were: a 1:1 teacher no-show is status no_show with
 * no_show_party "teacher"; a missed group lesson is status cancelled with missed_at set, so
 * payouts skip it. Attendance is stored per learner (student_attendance / attendance) and never
 * set by completing a session. Every change here is written to live_session_events.
 *
 * Settlement of a class paid from a live class credit happens once, guarded by the credit row:
 * only a credit still "booked" is spent or returned. A teacher's own completion leaves the credit
 * to the sweep, which pays the teacher only when the classroom shows they joined. An admin's
 * decision settles at once, so the sweep has nothing left to do for that class.
 */

type Exec = Kysely<DB>;

export type LiveSessionKind = "booking" | "group";
export type LiveActorType = "admin" | "teacher" | "learner" | "system";
export type LiveActor = { type: LiveActorType; id?: number | null; label?: string | null };
export type NoShowParty = "teacher" | "learner";
export type AttendanceMark = "attended" | "missed";

/* History values for attendance changes, kept apart from the session statuses in the same column. */
export const ATTENDANCE_EVENT = { attended: "attendance_attended", missed: "attendance_missed" } as const;

export class LiveLifecycleError extends Error {}

/* A stored 1:1 status in session terms, for the "from" side of a history entry. */
export const sessionStatusOf = (stored: string | null, noShowParty?: string | null) => {
  if (stored === "cancelled") return "cancelled";
  if (stored === "no_show") return noShowParty === "teacher" ? "missed" : "completed";
  if (stored === "completed") return "completed";
  return "scheduled";
};

/* The value kept in completed_by / cancelled_by / attendance_marked_by: an admin carries a name. */
export const actorStamp = (actor: LiveActor) =>
  actor.type === "admin" && actor.label ? `admin:${actor.label}` : actor.type === "learner" ? "student" : actor.type;

export async function recordSessionEvent(
  exec: Exec,
  e: { kind: LiveSessionKind; id: string; from: string | null; to: string; actor: LiveActor; reason?: string | null }
): Promise<void> {
  await exec
    .insertInto("liveSessionEvents")
    .values({
      sessionKind: e.kind,
      sessionId: e.id,
      fromStatus: e.from,
      toStatus: e.to,
      actorType: e.actor.type,
      actorId: e.actor.id ?? null,
      actorLabel: e.actor.label ?? null,
      reason: e.reason?.trim() || null,
    })
    .execute();
}

async function creditStillBooked(trx: Exec, creditId: string): Promise<boolean> {
  const credit = await trx.selectFrom("liveClassCredits").select("status").where("id", "=", creditId).forUpdate().executeTakeFirst();
  return credit?.status === "booked";
}

export type LifecycleResult = { status: "completed" | "no_show" | "missed"; changed: boolean };

/**
 * Marks a session completed (the teacher held it). Attendance is not touched. Repeating it is
 * harmless: a session already closed comes back unchanged. settleNow spends a still-booked credit
 * and pays the teacher.
 */
export async function completeLiveSession(args: {
  kind: LiveSessionKind;
  id: string;
  actor: LiveActor;
  settleNow: boolean;
  reason?: string | null;
}): Promise<LifecycleResult> {
  const now = new Date();
  return db.transaction().execute(async (trx) => {
    if (args.kind === "booking") {
      const b = await trx
        .selectFrom("mentorshipBookings")
        .select(["status", "scheduledAt", "creditId"])
        .where("id", "=", args.id)
        .forUpdate()
        .executeTakeFirst();
      if (!b) throw new LiveLifecycleError("This session was not found.");
      if (b.status === "completed" || b.status === "no_show") return { status: b.status, changed: false };
      if (b.status === "cancelled") throw new LiveLifecycleError("This session was cancelled.");
      if (new Date(b.scheduledAt) > now) throw new LiveLifecycleError("This session hasn't started yet.");

      const settle = args.settleNow && !!b.creditId && (await creditStillBooked(trx, b.creditId));
      await trx
        .updateTable("mentorshipBookings")
        .set({
          status: "completed",
          completedAt: now,
          completedBy: actorStamp(args.actor),
          ...(settle ? { earningStatus: "earned" } : {}),
          updatedAt: now,
        })
        .where("id", "=", args.id)
        .execute();
      if (settle) await spendCredit(trx, b.creditId as string);
      await recordSessionEvent(trx, { kind: "booking", id: args.id, from: "scheduled", to: "completed", actor: args.actor, reason: args.reason });
      return { status: "completed", changed: true };
    }

    const g = await trx
      .selectFrom("groupLessons")
      .select(["status", "startTime", "missedAt"])
      .where("id", "=", args.id)
      .forUpdate()
      .executeTakeFirst();
    if (!g) throw new LiveLifecycleError("This group lesson was not found.");
    if (g.status === "completed") return { status: "completed", changed: false };
    if (g.missedAt) throw new LiveLifecycleError("This group lesson is already marked missed.");
    if (g.status === "cancelled") throw new LiveLifecycleError("This group lesson was cancelled.");
    if (new Date(g.startTime) > now) throw new LiveLifecycleError("This lesson hasn't started yet.");

    await trx
      .updateTable("groupLessons")
      .set({ status: "completed", completedAt: now, completedBy: actorStamp(args.actor), updatedAt: now })
      .where("id", "=", args.id)
      .execute();
    await recordSessionEvent(trx, { kind: "group", id: args.id, from: "scheduled", to: "completed", actor: args.actor, reason: args.reason });
    return { status: "completed", changed: true };
  });
}

/**
 * A 1:1 no-show. Learner absent: the teacher held the session, so it reads as completed with the
 * learner missed, and it is charged (settleNow spends a still-booked credit, the teacher is paid).
 * Teacher absent: the session is missed, the teacher is not paid and a still-booked credit goes
 * back to the learner. An order payment is never refunded here; that stays a decision in Orders.
 */
export async function markLiveSessionNoShow(args: {
  id: string;
  party: NoShowParty;
  actor: LiveActor;
  settleNow: boolean;
  reason?: string | null;
}): Promise<LifecycleResult & { creditReturned: "unscheduled" | "released" | null }> {
  const now = new Date();
  const teacherAbsent = args.party === "teacher";
  const result = await db.transaction().execute(async (trx) => {
    const b = await trx
      .selectFrom("mentorshipBookings")
      .select(["status", "scheduledAt", "creditId", "noShowParty"])
      .where("id", "=", args.id)
      .forUpdate()
      .executeTakeFirst();
    if (!b) throw new LiveLifecycleError("This session was not found.");
    const outcome = teacherAbsent ? ("missed" as const) : ("no_show" as const);
    if (b.status === "no_show") {
      if ((b.noShowParty ?? "learner") === args.party) return { status: outcome, changed: false, creditReturned: null };
      throw new LiveLifecycleError(teacherAbsent ? "The learner was already marked absent." : "This session is already marked missed.");
    }
    if (b.status === "completed") throw new LiveLifecycleError("This session is already marked completed.");
    if (b.status === "cancelled") throw new LiveLifecycleError("This session was cancelled.");
    if (new Date(b.scheduledAt) > now) throw new LiveLifecycleError("This session hasn't started yet.");

    const booked = !!b.creditId && (await creditStillBooked(trx, b.creditId));
    const settle = booked && (args.settleNow || teacherAbsent);
    await trx
      .updateTable("mentorshipBookings")
      .set({
        status: "no_show",
        noShowParty: args.party,
        noShowReason: args.reason?.trim() || null,
        ...(teacherAbsent ? {} : { completedAt: now, completedBy: actorStamp(args.actor) }),
        ...(settle ? { earningStatus: teacherAbsent ? "void" : "earned" } : {}),
        updatedAt: now,
      })
      .where("id", "=", args.id)
      .execute();
    let creditReturned: "unscheduled" | "released" | null = null;
    if (settle && teacherAbsent) creditReturned = await returnCredit(trx, b.creditId as string);
    else if (settle) await spendCredit(trx, b.creditId as string);
    await recordSessionEvent(trx, {
      kind: "booking",
      id: args.id,
      from: "scheduled",
      to: teacherAbsent ? "missed" : "completed",
      actor: args.actor,
      reason: [teacherAbsent ? null : "Learner did not attend.", args.reason?.trim()].filter(Boolean).join(" "),
    });
    return { status: outcome, changed: true, creditReturned };
  });
  if (result.creditReturned) await sendClassRefundedEmail(args.id, result.creditReturned);
  return result;
}

/**
 * A group lesson the teacher did not hold. Stored cancelled with missed_at, so it drops out of the
 * teacher's payouts the way a cancelled lesson does. Learners' attendance is left as it is and no
 * payment is refunded automatically.
 */
export async function markGroupLessonMissed(args: { id: string; actor: LiveActor; reason?: string | null }): Promise<LifecycleResult> {
  const now = new Date();
  return db.transaction().execute(async (trx) => {
    const g = await trx
      .selectFrom("groupLessons")
      .select(["status", "startTime", "missedAt"])
      .where("id", "=", args.id)
      .forUpdate()
      .executeTakeFirst();
    if (!g) throw new LiveLifecycleError("This group lesson was not found.");
    if (g.missedAt) return { status: "missed", changed: false };
    if (g.status === "completed") throw new LiveLifecycleError("This group lesson is already marked completed.");
    if (g.status === "cancelled") throw new LiveLifecycleError("This group lesson was cancelled.");
    if (new Date(g.startTime) > now) throw new LiveLifecycleError("This lesson hasn't started yet.");

    await trx
      .updateTable("groupLessons")
      .set({
        status: "cancelled",
        missedAt: now,
        cancelledAt: now,
        cancelledBy: actorStamp(args.actor),
        cancellationReason: args.reason?.trim() || "The teacher did not hold the lesson.",
        updatedAt: now,
      })
      .where("id", "=", args.id)
      .execute();
    await recordSessionEvent(trx, { kind: "group", id: args.id, from: "scheduled", to: "missed", actor: args.actor, reason: args.reason });
    return { status: "missed", changed: true };
  });
}

async function learnerName(trx: Exec, studentId: number | null): Promise<string> {
  if (!studentId) return "Learner";
  const u = await trx.selectFrom("students").select("displayName").where("id", "=", studentId).executeTakeFirst();
  return u?.displayName ?? "Learner";
}

/**
 * Records whether one learner attended. Only for a place that is not cancelled, once the session
 * has started. It does not change the session status or any payment.
 */
export async function setLiveAttendance(args: {
  type: LiveSessionKind;
  id: string;
  attendance: AttendanceMark;
  actor: LiveActor;
  reason?: string | null;
}): Promise<{ changed: boolean }> {
  const now = new Date();
  return db.transaction().execute(async (trx) => {
    if (args.type === "booking") {
      const b = await trx
        .selectFrom("mentorshipBookings")
        .select(["status", "cancelledBy", "cancellationReason", "scheduledAt", "studentAttendance", "studentId"])
        .where("id", "=", args.id)
        .forUpdate()
        .executeTakeFirst();
      if (!b) throw new LiveLifecycleError("This booking was not found.");
      const sweepMissed = b.status === "cancelled" && b.cancelledBy === "system" && b.cancellationReason === SWEEP_TEACHER_ABSENT_REASON;
      if (b.status === "cancelled" && !sweepMissed) throw new LiveLifecycleError("This booking was cancelled.");
      if (new Date(b.scheduledAt) > now) throw new LiveLifecycleError("This session hasn't started yet.");
      if (b.studentAttendance === args.attendance) return { changed: false };

      await trx
        .updateTable("mentorshipBookings")
        .set({ studentAttendance: args.attendance, attendanceMarkedAt: now, attendanceMarkedBy: actorStamp(args.actor), updatedAt: now })
        .where("id", "=", args.id)
        .execute();
      await recordSessionEvent(trx, {
        kind: "booking",
        id: args.id,
        from: null,
        to: ATTENDANCE_EVENT[args.attendance],
        actor: args.actor,
        reason: [await learnerName(trx, b.studentId), args.reason?.trim()].filter(Boolean).join(": "),
      });
      return { changed: true };
    }

    const e = await trx
      .selectFrom("groupLessonEnrollments")
      .select(["status", "attendance", "groupLessonId", "studentId"])
      .where("id", "=", args.id)
      .forUpdate()
      .executeTakeFirst();
    if (!e) throw new LiveLifecycleError("This enrollment was not found.");
    const lesson = await trx
      .selectFrom("groupLessons")
      .select(["status", "missedAt", "startTime"])
      .where("id", "=", e.groupLessonId)
      .executeTakeFirstOrThrow();
    if (e.status === "cancelled" || e.status === "removed") throw new LiveLifecycleError("This learner's place was cancelled.");
    if (lesson.status === "cancelled" && !lesson.missedAt) throw new LiveLifecycleError("This group lesson was cancelled.");
    if (new Date(lesson.startTime) > now) throw new LiveLifecycleError("This lesson hasn't started yet.");
    if (e.attendance === args.attendance) return { changed: false };

    await trx
      .updateTable("groupLessonEnrollments")
      .set({ attendance: args.attendance, attendanceMarkedAt: now, attendanceMarkedBy: actorStamp(args.actor) })
      .where("id", "=", args.id)
      .execute();
    await recordSessionEvent(trx, {
      kind: "group",
      id: e.groupLessonId,
      from: null,
      to: ATTENDANCE_EVENT[args.attendance],
      actor: args.actor,
      reason: [await learnerName(trx, e.studentId), args.reason?.trim()].filter(Boolean).join(": "),
    });
    return { changed: true };
  });
}
