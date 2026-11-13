/**
 * Shared, non-DB-backed defaults for the live teaching feature (1:1 mentorship bookings and group
 * lessons). These are code-level policy constants rather than admin-editable settings: the project
 * has no generic key/value site-settings table to hang them off, so changing them means changing
 * this file and redeploying, same as other policy constants elsewhere in the codebase. The admin
 * live lessons page surfaces them read-only so admins know what rules are being enforced.
 */

/** How long before a scheduled session its join page/credentials become available. */
export const JOIN_WINDOW_MINUTES_BEFORE = 10;
/** How long after a session's scheduled end time learners/teachers may still join (e.g. it overran). */
export const JOIN_WINDOW_MINUTES_AFTER = 30;

/** Minimum notice required to book or reschedule a 1:1 session into a slot. */
export const BOOKING_MIN_NOTICE_MINUTES = 60;
/**
 * A student may cancel or reschedule a 1:1 class up to this many hours before it starts with no
 * penalty. Later than that, or not joining, the class is charged in full.
 */
export const FREE_CANCELLATION_CUTOFF_HOURS = 6;

/** A package cycle is 4 weeks of N classes per week. */
export const PACKAGE_WEEKS = 4;
export const PACKAGE_CYCLE_DAYS = 28;
export const PACKAGE_MAX_CLASSES_PER_WEEK = 6;
/** The next cycle is set up (slots held, renewal debit raised) this many days before the current one ends. */
export const PACKAGE_RENEW_LEAD_DAYS = 2;
/** After a failed renewal debit the student has this long to pay before the package ends. */
export const PACKAGE_GRACE_DAYS = 3;
/** Picked slots and live class balance stay held this long while a checkout runs. */
export const CHECKOUT_HOLD_MINUTES = 30;
/** A class waiting to be scheduled can be booked up to this many days ahead. */
export const CREDIT_SCHEDULE_MAX_DAYS = 60;
/** A student can report that the teacher did not come for this long after a class ends. */
export const ISSUE_REPORT_WINDOW_HOURS = 24;

/** Gap kept free between a teacher's consecutive bookings when generating bookable slots. */
export const DEFAULT_SLOT_BUFFER_MINUTES = 10;

/** Group lesson capacity bounds enforced server-side regardless of what a teacher requests. */
export const GROUP_LESSON_MIN_CAPACITY = 1;
export const GROUP_LESSON_MAX_CAPACITY = 1000;

/**
 * Lengths a new 1:1 class can be booked at: the short session and the full session. Every
 * approved teacher sets a price for each and can be booked for either, with no per-teacher
 * "offering" to create first.
 */
export const MENTORSHIP_SESSION_DURATIONS = [25, 50] as const;
export const SHORT_SESSION_MINUTES = MENTORSHIP_SESSION_DURATIONS[0];
export const FULL_SESSION_MINUTES = MENTORSHIP_SESSION_DURATIONS[1];

/** Lengths sold from 18-11-2026 to 20-11-2026. Classes already booked at them can still be moved to another slot. */
export const LEGACY_SESSION_DURATIONS = [30, 60] as const;

/** Any length a slot can be generated for: current ones plus legacy ones for existing classes. */
export const isSlotDuration = (m: number) =>
  (MENTORSHIP_SESSION_DURATIONS as readonly number[]).includes(m) || (LEGACY_SESSION_DURATIONS as readonly number[]).includes(m);

/**
 * users.mentorship_rate_per_unit is the teacher's short session price and
 * users.mentorship_class_price60 the full session one (the column name is older than the
 * 50-minute length; see helpers/livePricing).
 */
export const MENTORSHIP_RATE_UNIT_MINUTES = SHORT_SESSION_MINUTES;

/** Floor on each class price. Also enforced by check constraints on users. */
export const MENTORSHIP_MIN_CLASS_PRICE = { 25: 49, 50: 99 } as const;
export const MENTORSHIP_MIN_RATE_PER_UNIT = MENTORSHIP_MIN_CLASS_PRICE[25];

/** Percent off the class price for a trial, when the teacher turns the trial discount on. */
export const MENTORSHIP_TRIAL_DISCOUNT_PERCENT = { 25: 30, 50: 50 } as const;

/**
 * The sweep settles a credit-paid 1:1 class this long after it ends: completed when the teacher
 * joined the classroom, cancelled with the credit returned when they did not. Other sessions are
 * never completed automatically; they wait for the teacher or an admin.
 */
export const AUTO_COMPLETE_AFTER_MINUTES = 180;

/** A session still not marked this long after it ended gets one reminder email to its teacher. */
export const COMPLETION_OVERDUE_HOURS = 24;
/** The overdue email goes only for sessions that ended within this many days; older ones are just flagged. */
export const COMPLETION_REMINDER_MAX_AGE_DAYS = 7;

/**
 * Video provider: "daily" routes through a real Daily.co room via helpers/videoProvider.tsx, using
 * the server-only DAILY_API_KEY secret. If that secret isn't connected yet, getVideoProvider()
 * falls back to the clearly-labeled development-only mock automatically (it re-checks on every
 * call, so no redeploy is needed once the key is connected) - this constant only expresses intent,
 * not the final runtime choice. See helpers/videoProvider.tsx for the actual selection logic.
 */
export const VIDEO_PROVIDER_MODE: "mock" | "daily" = "daily";
