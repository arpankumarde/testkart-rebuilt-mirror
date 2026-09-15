const inrFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const inrDecimalFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const countFormatter = new Intl.NumberFormat("en-IN");

const inr = (amount: number): string => {
  const rounded = Math.abs(amount) >= 100 ? inrFormatter.format(amount) : inrDecimalFormatter.format(amount);
  return `₹${rounded}`;
};

const inrCompact = (amount: number): string => {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(abs >= 100000000 ? 0 : 1)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(abs >= 1000000 ? 0 : 1)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
};

const count = (value: number): string => countFormatter.format(value);

type Delta = { text: string; tone: "up" | "down" | "flat" | "new" };

const delta = (current: number, previous: number): Delta => {
  if (previous === 0 && current === 0) return { text: "no change", tone: "flat" };
  if (previous === 0) return { text: "new", tone: "new" };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.5) return { text: "no change", tone: "flat" };
  const rounded = Math.abs(change) >= 100 ? Math.round(change) : Math.round(change * 10) / 10;
  return { text: `${change > 0 ? "+" : "-"}${Math.abs(rounded)}%`, tone: change > 0 ? "up" : "down" };
};

const relativeTime = (date: Date | string | null | undefined, now: number = Date.now()): string => {
  if (!date) return "";
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-06" to "6 Sep". Works on the ISO day strings the overview emits. */
const dayLabel = (isoDay: string): string => {
  const [, month, day] = isoDay.split("-").map(Number);
  if (!month || !day) return isoDay;
  return `${day} ${MONTHS[month - 1]}`;
};

const share = (part: number, whole: number): number => (whole <= 0 ? 0 : Math.round((part / whole) * 1000) / 10);

export const adminFormat = { inr, inrCompact, count, delta, relativeTime, dayLabel, share };
