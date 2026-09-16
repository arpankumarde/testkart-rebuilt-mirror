const timeFormatter = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
const weekdayFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "short" });
const dayMonthFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const longDayFormatter = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const stampFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

type DateInput = Date | string;

const startOfDay = (time: number) => {
  const day = new Date(time);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};

const calendarDaysAgo = (date: Date, now: number) => Math.round((startOfDay(now) - startOfDay(date.getTime())) / 86_400_000);

export const supportTime = (value: DateInput) => timeFormatter.format(new Date(value));

export const supportDate = (value: DateInput) => dateFormatter.format(new Date(value));

export const supportTimestamp = (value: DateInput) => stampFormatter.format(new Date(value));

/* Inbox row time, as mail apps show it: the time today, then Yesterday, the weekday this week, then the date. */
export const supportListTime = (value: DateInput, now: number) => {
  const date = new Date(value);
  const days = calendarDaysAgo(date, now);
  if (days <= 0) return timeFormatter.format(date);
  if (days === 1) return "Yesterday";
  if (days < 7) return weekdayFormatter.format(date);
  return date.getFullYear() === new Date(now).getFullYear() ? dayMonthFormatter.format(date) : dateFormatter.format(date);
};

export const supportDayKey = (value: DateInput) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export const supportDayLabel = (value: DateInput, now: number) => {
  const date = new Date(value);
  const days = calendarDaysAgo(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return longDayFormatter.format(date);
};

export const supportStatusLabel = (status: string) =>
  status === "open" ? "Open" : status === "resolved" ? "Resolved" : status === "closed" ? "Closed" : status;

export const supportStatusBadge = (status: string): "warning" | "success" | "secondary" | "default" =>
  status === "open" ? "warning" : status === "resolved" ? "success" : status === "closed" ? "secondary" : "default";