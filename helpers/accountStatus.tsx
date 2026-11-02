/*
 * Admin suspensions and bans (users.is_active plus the suspension_* columns).
 * Pure functions only, so the admin pages and the server share one reading of
 * a row. A suspension with an end date lifts itself once that date passes; a
 * ban, or a suspension without an end date, lasts until an admin reactivates.
 */

export type AccountStatus = "active" | "suspended" | "banned";
export type SuspensionKind = "suspended" | "banned";

export const ACCOUNT_APPEAL_EMAIL = "ham@testkart.in";

export interface AccountStatusFields {
  isActive: boolean;
  suspensionKind: string | null;
  suspendedUntil: Date | string | null;
}

export function getAccountStatus(row: AccountStatusFields, now: Date = new Date()): AccountStatus {
  if (row.isActive) return "active";
  if (row.suspensionKind === "banned") return "banned";
  if (row.suspendedUntil && new Date(row.suspendedUntil).getTime() <= now.getTime()) return "active";
  return "suspended";
}

const IST_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "19-11-2026, 3:45 PM IST" */
export function formatIstDateTime(value: Date | string): string {
  const parts: Record<string, string> = {};
  for (const part of IST_FORMAT.formatToParts(new Date(value))) parts[part.type] = part.value;
  const period = (parts.dayPeriod ?? "").toUpperCase();
  return `${parts.day}-${parts.month}-${parts.year}, ${parts.hour}:${parts.minute}${period ? ` ${period}` : ""} IST`;
}

/** What a blocked user is told when they try to sign in. */
export function accountBlockedMessage(row: AccountStatusFields): string {
  const appeal = `If you think this is a mistake, email ${ACCOUNT_APPEAL_EMAIL}.`;
  if (row.suspensionKind === "banned") {
    return `Your Testkart account has been permanently banned. ${appeal}`;
  }
  if (row.suspendedUntil) {
    return `Your Testkart account is suspended until ${formatIstDateTime(row.suspendedUntil)}. ${appeal}`;
  }
  return `Your Testkart account is suspended. ${appeal}`;
}