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
/** How close to the start time a booking may still be cancelled/rescheduled for a full refund/credit. */
export const FREE_CANCELLATION_CUTOFF_HOURS = 12;

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

/** The base unit 1:1 pricing is quoted in: a teacher's rate is "price per this many minutes". */
export const MENTORSHIP_RATE_UNIT_MINUTES = 25;

/** Floor on what a teacher may charge per MENTORSHIP_RATE_UNIT_MINUTES of 1:1 time. */
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
