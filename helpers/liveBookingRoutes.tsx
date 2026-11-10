/**
 * The 1:1 trial and package booking page for one tutor, addressed by the teacher's slug. A teacher
 * without a slug has no booking page, so the link falls back to the tutor directory.
 */
export const liveBookingPath = (teacher: { slug: string | null }, durationMinutes?: number) =>
  teacher.slug
    ? `/live-teaching/book/${encodeURIComponent(teacher.slug)}${durationMinutes ? `?duration=${durationMinutes}` : ""}`
    : "/expert";
