/*
 * Rules shared by the browser and the server for live courses: multi-week live batches whose
 * classes are group_lessons rows carrying live_course_id. All times are shown and entered in IST.
 */

export const LIVE_COURSE_SEAT_LIMIT_MAX = 100;
export const LIVE_COURSE_MAX_CLASSES = 300;
export const LIVE_COURSE_CLASS_MIN_MINUTES = 15;
export const LIVE_COURSE_CLASS_MAX_MINUTES = 300;
/** The refund guarantee closes when this class (1-based, cancelled classes skipped) starts. */
export const LIVE_COURSE_REFUND_CLOSES_AT_CLASS = 3;

export const LIVE_COURSE_LIST_PATH = "/course/live";
export const liveCoursePath = (slug: string) => `/live-courses/${slug}`;
export const studentLiveCoursesPath = "/student/live-courses";
export const teacherLiveCoursesPath = "/teacher/live-courses";
export const teacherLiveCoursePath = (id: string) => `/teacher/live-courses/${id}`;
export const classroomPath = (classId: string) => `/mentorship/classroom/group/${classId}`;

export const LIVE_COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type LiveCourseLevel = (typeof LIVE_COURSE_LEVELS)[number];
export type LiveCourseStatus = "draft" | "published" | "cancelled" | "completed";

/** Monday = 1 ... Sunday = 7, as people read a week. */
export const WEEKDAYS = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 7, short: "Sun" },
] as const;

const IST_OFFSET_MIN = 330;

/** "2026-12-06" + "19:30" in IST -> the instant. */
export function istToDate(dateYmd: string, timeHm: string): Date {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = timeHm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MIN * 60000);
}

/** The instant as IST date and time strings for form fields. */
export function dateToIst(at: Date | string): { date: string; time: string } {
  const shifted = new Date(new Date(at).getTime() + IST_OFFSET_MIN * 60000);
  const iso = shifted.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

const istWeekday = (dateYmd: string): number => {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
};

const addDays = (dateYmd: string, days: number): string => {
  const [y, m, d] = dateYmd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export type WeeklyPattern = {
  fromDate: string;
  toDate: string;
  weekdays: number[];
  time: string;
  durationMinutes: number;
};

/** Every class start the pattern produces, in order, capped at LIVE_COURSE_MAX_CLASSES. */
export function expandWeeklyPattern(p: WeeklyPattern): { startTime: Date; durationMinutes: number }[] {
  const days = new Set(p.weekdays);
  const out: { startTime: Date; durationMinutes: number }[] = [];
  if (days.size === 0 || p.toDate < p.fromDate) return out;
  for (let day = p.fromDate; day <= p.toDate && out.length < LIVE_COURSE_MAX_CLASSES; day = addDays(day, 1)) {
    if (days.has(istWeekday(day))) out.push({ startTime: istToDate(day, p.time), durationMinutes: p.durationMinutes });
  }
  return out;
}

/** Slug from a title with years removed (series and course slugs never carry a year). */
export function liveCourseSlugBase(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/\b(19|20)\d{2}(-\d{2,4})?\b/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "live-course";
}

export const formatIstShort = (at: Date | string) =>
  new Date(at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export const formatIstDate = (at: Date | string) =>
  new Date(at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export const formatRupees = (amount: number | string) => `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
