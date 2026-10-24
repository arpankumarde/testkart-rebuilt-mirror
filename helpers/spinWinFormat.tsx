const dateFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", month: "short", day: "2-digit", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Nov 03, 2026" in IST, the admin list format. */
export const spinDate = (value: Date | string | null | undefined): string => (value ? dateFormatter.format(new Date(value)) : "");

/** "3 Nov 2026, 9:30 pm" in IST. */
export const spinDateTime = (value: Date | string | null | undefined): string => (value ? `${dateTimeFormatter.format(new Date(value))} IST` : "");