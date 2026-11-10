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
 * Allowed 1:1 session durations (minutes). Deliberately short and few, Preply-style: a teacher
 * sets one rate (per 25 minutes) and every approved teacher can be booked for either length, with
 * no per-teacher "offering" to create first. Keeping only two short lengths also leaves teachers a
 * window to take another booking between sessions, rather than getting locked into long blocks.
 */
export const MENTORSHIP_SESSION_DURATIONS = [25, 50] as const;

/**
 * users.mentorship_rate_per_unit is the teacher's 25-minute class price. The 50-minute class
 * price and both trial prices have their own columns (see helpers/livePricing).
 */
export const MENTORSHIP_RATE_UNIT_MINUTES = 25;

/** Floor on a 25-minute class price; a 50-minute class has twice this floor. Trials have no floor. */
export const MENTORSHIP_MIN_RATE_PER_UNIT = 49;

/** A booking/enrollment is auto-marked completed this long after its scheduled end if nobody closed it out. */
export const AUTO_COMPLETE_AFTER_MINUTES = 180;

/**
 * Video provider: "daily" routes through a real Daily.co room via helpers/videoProvider.tsx, using
 * the server-only DAILY_API_KEY secret. If that secret isn't connected yet, getVideoProvider()
 * falls back to the clearly-labeled development-only mock automatically (it re-checks on every
 * call, so no redeploy is needed once the key is connected) - this constant only expresses intent,
 * not the final runtime choice. See helpers/videoProvider.tsx for the actual selection logic.
 */
export const VIDEO_PROVIDER_MODE: "mock" | "daily" = "daily";
