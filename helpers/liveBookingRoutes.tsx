import { FULL_SESSION_MINUTES, SHORT_SESSION_MINUTES } from "./liveLessonConfig";

export type LiveSessionType = "short" | "full";

/** The ?type= value for a class length. Older 30 / 60 minute lengths keep the matching type. */
export const sessionTypeForMinutes = (minutes: number): LiveSessionType => (minutes <= 30 ? "short" : "full");

/**
 * The class length a booking link asks for: ?type=short|full, or the older ?duration=25|50 that
 * emails and shared links already carry. Null when the link names neither.
 */
export const requestedSessionMinutes = (search: string): number | null => {
  const params = new URLSearchParams(search);
  const type = params.get("type");
  if (type === "short") return SHORT_SESSION_MINUTES;
  if (type === "full") return FULL_SESSION_MINUTES;
  const legacy = Number(params.get("duration"));
  return legacy > 0 ? legacy : null;
};

/**
 * The 1:1 trial and package booking page for one tutor, addressed by the teacher's slug. A teacher
 * without a slug has no booking page, so the link falls back to the tutor directory.
 */
export const liveBookingPath = (teacher: { slug: string | null }, durationMinutes?: number) =>
  teacher.slug
    ? `/live-teaching/book/${encodeURIComponent(teacher.slug)}${durationMinutes ? `?type=${sessionTypeForMinutes(durationMinutes)}` : ""}`
    : "/expert";
