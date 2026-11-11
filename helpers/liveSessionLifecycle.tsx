import type { Kysely } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { returnCredit, spendCredit } from "./livePackages";
import { sendClassRefundedEmail } from "./livePackageEmails";

/*
 * Server-only lifecycle of a live session (a 1:1 booking or a group lesson).
 *
 * Stored statuses stay scheduled | completed | cancelled | no_show. "Awaiting completion" is a
 * scheduled session whose end time has passed: nobody has closed it yet. Every change made here
 * is written to live_session_events.
 *
 * Settlement of a class paid from a live class credit happens once, guarded by the credit row:
 * only a credit still "booked" is spent or returned. A teacher's own completion leaves the credit
 * to the sweep, which pays the teacher only when the classroom shows they joined. An admin's
 * decision settles at once, so the sweep has nothing left to do for that class.
 */

type Exec = Kysely<DB>;

export type LiveSessionKind = "booking" | "group";
export type LiveLifecycleStatus = "scheduled" | "awaiting_completion" | "completed" | "cancelled" | "no_show";
export type LiveActorType = "admin" | "teacher" | "learner" | "system";
export type LiveActor = { type: LiveActorType; id?: number | null; label?: string | null };
export type NoShowParty = "teacher" | "learner";

export class LiveLifecycleError extends Error {}

export const hasEnded = (start: Date | string, minutes: number, now = Date.now()) =>
  new Date(start).getTime() + minutes * 60000 <= now;

export const lifecycleStatusOf = (stored: string | null, start: Date | string, minutes: number): LiveLifecycleStatus => {
  const s = stored ?? "scheduled";
  if (s === "scheduled") return hasEnded(start, minutes) ? "awaiting_completion" : "scheduled";
  return s as LiveLifecycleStatus;
};

/* The value kept in completed_by / cancelled_by: an admin carries a name, as admin cancellations already do. */
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

export type LifecycleResult = {
  status: "completed" | "no_show";
  changed: boolean;
};

/**
 * Marks a session completed. Repeating it is harmless: a session that is already completed or a
 * no-show comes back unchanged. settleNow spends a still-booked credit and pays the teacher.
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
        .select(["status", "scheduledAt", "durationMinutes", "creditId"])
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
      await recordSessionEvent(trx, {
        kind: "booking",
        id: args.id,
        from: lifecycleStatusOf(b.status, b.scheduledAt, b.durationMinutes),
        to: "completed",
        actor: args.actor,
        reason: args.reason,
      });
      return { status: "completed", changed: true };
    }

    const g = await trx
      .selectFrom("groupLessons")
      .select(["status", "startTime", "durationMinutes"])
      .where("id", "=", args.id)
      .forUpdate()
      .executeTakeFirst();
    if (!g) throw new LiveLifecycleError("This group lesson was not found.");
    if (g.status === "completed") return { status: "completed", changed: false };
    if (g.status === "cancelled") throw new LiveLifecycleError("This group lesson was cancelled.");
    if (new Date(g.startTime) > now) throw new LiveLifecycleError("This lesson hasn't started yet.");

    await trx
      .updateTable("groupLessons")
      .set({ status: "completed", completedAt: now, completedBy: actorStamp(args.actor), updatedAt: now })
      .where("id", "=", args.id)
      .execute();
    await recordSessionEvent(trx, {
      kind: "group",
      id: args.id,
      from: lifecycleStatusOf(g.status, g.startTime, g.durationMinutes),
      to: "completed",
      actor: args.actor,
      reason: args.reason,
    });
    return { status: "completed", changed: true };
  });
}

/**
 * Marks a 1:1 session a no-show. A learner no-show is charged: with settleNow a still-booked credit
 * is spent and the teacher is paid. A teacher no-show is not paid: a still-booked credit goes back
 * to the learner. An order payment is never refunded here; that stays a decision in Orders.
 */
export async function markLiveSessionNoShow(args: {
  id: string;
  party: NoShowParty;
  actor: LiveActor;
  settleNow: boolean;
  reason?: string | null;
}): Promise<LifecycleResult & { creditReturned: "unscheduled" | "released" | null }> {
  const now = new Date();
  const result = await db.transaction().execute(async (trx) => {
    const b = await trx
      .selectFrom("mentorshipBookings")
      .select(["status", "scheduledAt", "durationMinutes", "creditId", "noShowParty"])
      .where("id", "=", args.id)
      .forUpdate()
      .executeTakeFirst();
    if (!b) throw new LiveLifecycleError("This session was not found.");
    if (b.status === "no_show") {
      if ((b.noShowParty ?? "learner") === args.party) return { status: "no_show" as const, changed: false, creditReturned: null };
      throw new LiveLifecycleError("This session is already marked as a no-show for the other side.");
    }
    if (b.status === "completed") throw new LiveLifecycleError("This session is already marked completed.");
    if (b.status === "cancelled") throw new LiveLifecycleError("This session was cancelled.");
    if (new Date(b.scheduledAt) > now) throw new LiveLifecycleError("This session hasn't started yet.");

    const booked = !!b.creditId && (await creditStillBooked(trx, b.creditId));
    const teacherAbsent = args.party === "teacher";
    const settle = booked && (args.settleNow || teacherAbsent);
    await trx
      .updateTable("mentorshipBookings")
      .set({
        status: "no_show",
        noShowParty: args.party,
        noShowReason: args.reason?.trim() || null,
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
      from: lifecycleStatusOf(b.status, b.scheduledAt, b.durationMinutes),
      to: "no_show",
      actor: args.actor,
      reason: [teacherAbsent ? "Teacher did not attend." : "Learner did not attend.", args.reason?.trim()].filter(Boolean).join(" "),
    });
    return { status: "no_show" as const, changed: true, creditReturned };
  });
  if (result.creditReturned) await sendClassRefundedEmail(args.id, result.creditReturned);
  return result;
}
