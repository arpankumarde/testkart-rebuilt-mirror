import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { Kysely } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { BOOKING_MIN_NOTICE_MINUTES, DEFAULT_SLOT_BUFFER_MINUTES, PACKAGE_MAX_CLASSES_PER_WEEK } from "./liveLessonConfig";

export interface AvailableSlot {
  startTime: Date;
  endTime: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const parseTimeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (Number.isFinite(m) ? m : 0);
};

/**
 * Generates bookable 1:1 slots for a teacher between fromDate/toDate (UTC instants), of the given
 * duration, from their weekly mentorship_availability windows. Excludes mentorship_blocked_dates,
 * any time already covered by a non-cancelled mentorship_bookings row, and anything inside the
 * minimum booking notice window. All wall-clock arithmetic happens in the teacher's own
 * users.timezone so the result is correct across DST; the slots themselves are canonical UTC
 * instants, converted to the viewer's timezone only at render time.
 *
 * Re-run this exact logic inside the booking transaction at write time (see
 * endpoints/mentorship/bookings/create_POST.ts) rather than trusting a slot the client cached -
 * that is what prevents two learners racing for the same slot.
 */
export async function generateTeacherSlots(
  teacherId: number,
  durationMinutes: number,
  fromDate: Date,
  toDate: Date
): Promise<AvailableSlot[]> {
  const teacher = await db.selectFrom("users").select(["timezone"]).where("id", "=", teacherId).executeTakeFirst();
  if (!teacher) return [];
  const timezone = teacher.timezone;

  const [availability, blockedDates, existingBookings, existingGroupLessons, holds] = await Promise.all([
    db
      .selectFrom("mentorshipAvailability")
      .select(["dayOfWeek", "startTime", "endTime"])
      .where("teacherId", "=", teacherId)
      .where("isActive", "=", true)
      .execute(),
    db.selectFrom("mentorshipBlockedDates").select(["blockedDate"]).where("teacherId", "=", teacherId).execute(),
    db
      .selectFrom("mentorshipBookings")
      .select(["scheduledAt", "durationMinutes"])
      .where("teacherId", "=", teacherId)
      .where("status", "!=", "cancelled")
      .execute(),
    // Same teacher teaches both 1:1 sessions and group lessons, so a 1:1 slot
    // must also be blocked out by any group lesson already on their calendar.
    db
      .selectFrom("groupLessons")
      .select(["startTime as scheduledAt", "durationMinutes"])
      .where("teacherId", "=", teacherId)
      .where("status", "=", "scheduled")
      .execute(),
    activeHolds(db, teacherId),
  ]);
  const busyBlocks = [...existingBookings, ...existingGroupLessons, ...holds];

  if (availability.length === 0) return [];

  const blockedDateKeys = new Set(
    blockedDates.map((b) => {
      const z = toZonedTime(new Date(b.blockedDate), timezone);
      return `${z.getFullYear()}-${z.getMonth()}-${z.getDate()}`;
    })
  );

  const now = new Date();
  const earliestBookable = new Date(now.getTime() + BOOKING_MIN_NOTICE_MINUTES * 60000);

  const byDay = new Map<number, { startTime: string; endTime: string }[]>();
  for (const row of availability) {
    const list = byDay.get(row.dayOfWeek) ?? [];
    list.push(row);
    byDay.set(row.dayOfWeek, list);
  }

  const slots: AvailableSlot[] = [];

  for (let cursor = fromDate.getTime(); cursor <= toDate.getTime(); cursor += DAY_MS) {
    const zoned = toZonedTime(new Date(cursor), timezone);
    const y = zoned.getFullYear();
    const m = zoned.getMonth();
    const d = zoned.getDate();
    const dayOfWeek = zoned.getDay();
    const dateKey = `${y}-${m}-${d}`;
    if (blockedDateKeys.has(dateKey)) continue;

    const windows = byDay.get(dayOfWeek);
    if (!windows) continue;

    for (const w of windows) {
      const startMin = parseTimeToMinutes(w.startTime);
      const endMin = parseTimeToMinutes(w.endTime);
      for (let t = startMin; t + durationMinutes <= endMin; t += durationMinutes + DEFAULT_SLOT_BUFFER_MINUTES) {
        const localStart = new Date(y, m, d, Math.floor(t / 60), t % 60, 0, 0);
        const utcStart = fromZonedTime(localStart, timezone);
        const utcEnd = new Date(utcStart.getTime() + durationMinutes * 60000);

        if (utcStart < earliestBookable) continue;
        if (utcStart < fromDate || utcStart > toDate) continue;

        const overlapsExisting = busyBlocks.some((b) => {
          const bStart = new Date(b.scheduledAt).getTime();
          const bEnd = bStart + b.durationMinutes * 60000;
          return utcStart.getTime() < bEnd && utcEnd.getTime() > bStart;
        });
        if (overlapsExisting) continue;

        slots.push({ startTime: utcStart, endTime: utcEnd });
      }
    }
  }

  slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return slots;
}

/**
 * Full server-side re-validation for a single candidate booking time: inside a weekly
 * availability window (in the teacher's own timezone), not on a blocked date, past the minimum
 * notice, and not overlapping an existing booking. Call this again inside the booking transaction
 * - never trust a slot the client cached, since availability can change between page load and
 * checkout and two learners can race for the same instant. Inside a transaction, pass its `trx`
 * as `executor`: the pool holds one connection, so a query on the global `db` would wait forever
 * on the connection the transaction itself is holding. Slots held for a package checkout or
 * renewal (live_slot_holds) count as taken, except the holds of `ignoreHoldCycleId`, the cycle
 * that is turning its own holds into bookings.
 */
export async function isTeacherSlotBookable(
  teacherId: number,
  startTime: Date,
  durationMinutes: number,
  executor: Kysely<DB> = db,
  options: { ignoreHoldCycleId?: string } = {}
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const now = new Date();
  const earliestBookable = new Date(now.getTime() + BOOKING_MIN_NOTICE_MINUTES * 60000);
  if (startTime < earliestBookable) {
    return { ok: false, reason: `Bookings need at least ${BOOKING_MIN_NOTICE_MINUTES} minutes' notice.` };
  }

  const teacher = await executor.selectFrom("users").select(["timezone"]).where("id", "=", teacherId).executeTakeFirst();
  if (!teacher) return { ok: false, reason: "Teacher not found." };
  const timezone = teacher.timezone;

  const zoned = toZonedTime(startTime, timezone);
  const dayOfWeek = zoned.getDay();
  const minutesOfDay = zoned.getHours() * 60 + zoned.getMinutes();

  const [windows, blocked] = await Promise.all([
    executor
      .selectFrom("mentorshipAvailability")
      .select(["startTime", "endTime"])
      .where("teacherId", "=", teacherId)
      .where("dayOfWeek", "=", dayOfWeek)
      .where("isActive", "=", true)
      .execute(),
    executor
      .selectFrom("mentorshipBlockedDates")
      .select(["blockedDate"])
      .where("teacherId", "=", teacherId)
      .execute(),
  ]);

  const isBlocked = blocked.some((b) => {
    const z = toZonedTime(new Date(b.blockedDate), timezone);
    return z.getFullYear() === zoned.getFullYear() && z.getMonth() === zoned.getMonth() && z.getDate() === zoned.getDate();
  });
  if (isBlocked) return { ok: false, reason: "The teacher has blocked this date." };

  const fits = windows.some((w) => {
    const startMin = parseTimeToMinutes(w.startTime);
    const endMin = parseTimeToMinutes(w.endTime);
    return minutesOfDay >= startMin && minutesOfDay + durationMinutes <= endMin;
  });
  if (!fits) return { ok: false, reason: "This time is outside the teacher's available hours." };

  const free = await isTeacherSlotFree(teacherId, startTime, durationMinutes, undefined, undefined, executor);
  if (!free) return { ok: false, reason: "This time was just booked by someone else. Please pick another slot." };

  const holds = await activeHolds(executor, teacherId, options.ignoreHoldCycleId);
  const endMs = startTime.getTime() + durationMinutes * 60000;
  const held = holds.some((h) => {
    const hStart = new Date(h.scheduledAt).getTime();
    return startTime.getTime() < hStart + h.durationMinutes * 60000 && endMs > hStart;
  });
  if (held) return { ok: false, reason: "This time is being held for another student. Please pick another slot." };

  return { ok: true };
}

/**
 * How many classes a week a package with this teacher can hold: one class a day, so the number of
 * weekdays the teacher has open hours, capped at PACKAGE_MAX_CLASSES_PER_WEEK.
 */
export async function teacherMaxClassesPerWeek(teacherId: number, executor: Kysely<DB> = db): Promise<number> {
  const rows = await executor
    .selectFrom("mentorshipAvailability")
    .select("dayOfWeek")
    .distinct()
    .where("teacherId", "=", teacherId)
    .where("isActive", "=", true)
    .execute();
  return Math.min(rows.length, PACKAGE_MAX_CLASSES_PER_WEEK);
}

/** Slots held for a package checkout or renewal that has not been paid yet. */
async function activeHolds(executor: Kysely<DB>, teacherId: number, ignoreCycleId?: string) {
  let q = executor
    .selectFrom("liveSlotHolds")
    .select(["startsAt as scheduledAt", "durationMinutes"])
    .where("teacherId", "=", teacherId)
    .where("expiresAt", ">", new Date());
  if (ignoreCycleId) q = q.where("cycleId", "!=", ignoreCycleId);
  return q.execute();
}

/**
 * True if [startTime, startTime+durationMinutes) overlaps no existing non-cancelled 1:1 booking
 * AND no scheduled group lesson for this teacher - the same teacher's calendar is shared across
 * both class types. excludeBookingId/excludeGroupLessonId let a reschedule/edit check against
 * everything else without tripping on its own current (about-to-change) row. Pass the
 * transaction as `executor` when calling from inside one.
 */
export async function isTeacherSlotFree(
  teacherId: number,
  startTime: Date,
  durationMinutes: number,
  excludeBookingId?: string,
  excludeGroupLessonId?: string,
  executor: Kysely<DB> = db
): Promise<boolean> {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  let bookingsQuery = executor
    .selectFrom("mentorshipBookings")
    .select(["id", "scheduledAt", "durationMinutes"])
    .where("teacherId", "=", teacherId)
    .where("status", "!=", "cancelled");
  if (excludeBookingId) {
    bookingsQuery = bookingsQuery.where("id", "!=", excludeBookingId);
  }

  let groupLessonsQuery = executor
    .selectFrom("groupLessons")
    .select(["id", "startTime as scheduledAt", "durationMinutes"])
    .where("teacherId", "=", teacherId)
    .where("status", "=", "scheduled");
  if (excludeGroupLessonId) {
    groupLessonsQuery = groupLessonsQuery.where("id", "!=", excludeGroupLessonId);
  }

  const [bookings, groupLessons] = await Promise.all([bookingsQuery.execute(), groupLessonsQuery.execute()]);
  const busyBlocks = [...bookings, ...groupLessons];

  return !busyBlocks.some((b) => {
    const bStart = new Date(b.scheduledAt).getTime();
    const bEnd = bStart + b.durationMinutes * 60000;
    return startTime.getTime() < bEnd && endTime.getTime() > bStart;
  });
}
