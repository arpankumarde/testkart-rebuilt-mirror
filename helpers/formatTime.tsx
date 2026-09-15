/**
 * Formats a date into a relative time string (e.g., "2 hours ago", "Just now").
 * Uses native Intl.RelativeTimeFormat to avoid heavy date manipulation libraries.
 */
export function formatRelativeTime(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return rtf.format(-Math.floor(diffInSeconds / 60), "minute");
  if (diffInSeconds < 86400) return rtf.format(-Math.floor(diffInSeconds / 3600), "hour");
  if (diffInSeconds < 2592000) return rtf.format(-Math.floor(diffInSeconds / 86400), "day");
  if (diffInSeconds < 31536000) return rtf.format(-Math.floor(diffInSeconds / 2592000), "month");
  return rtf.format(-Math.floor(diffInSeconds / 31536000), "year");
}

/**
 * Formats a date into a localized time string (e.g., "10:42 AM").
 */
export function formatMessageTime(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}