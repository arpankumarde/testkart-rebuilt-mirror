/*
 * One withdrawal request per user per calendar day in India (Asia/Kolkata).
 * Every request counts once submitted, whatever its status becomes later.
 * Shared by the request and list endpoints and the dashboards; the server
 * check that enforces it lives in withdrawalDailyLimitServer.tsx.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// India has no daylight saving, so the offset is fixed.
const IST_OFFSET_MS = 330 * 60 * 1000;

export const WITHDRAWAL_DAILY_LIMIT_CODE = "WITHDRAWAL_DAILY_LIMIT";
export const WITHDRAWAL_DAILY_LIMIT_MESSAGE =
  "You have already submitted a withdrawal request today. You can submit another request tomorrow.";

export type WithdrawalDailyLimit = {
  /* The user's most recent request, or null if they have never made one. */
  lastRequestedAt: Date | null;
  /* 12:00 AM IST after a request made today; null when a request is allowed now. */
  nextAvailableAt: Date | null;
};

/** 12:00 AM IST of the IST calendar day that contains `at`. */
export function istDayStart(at: Date): Date {
  const shifted = at.getTime() + IST_OFFSET_MS;
  const dayStartShifted = shifted - (((shifted % DAY_MS) + DAY_MS) % DAY_MS);
  return new Date(dayStartShifted - IST_OFFSET_MS);
}

/** 12:00 AM IST of the IST calendar day after the one that contains `at`. */
export function nextIstDayStart(at: Date): Date {
  return new Date(istDayStart(at).getTime() + DAY_MS);
}

export function getWithdrawalDailyLimit(
  lastRequestedAt: Date | string | null | undefined,
  now: Date = new Date()
): WithdrawalDailyLimit {
  const last = lastRequestedAt ? new Date(lastRequestedAt) : null;
  if (!last || Number.isNaN(last.getTime())) {
    return { lastRequestedAt: null, nextAvailableAt: null };
  }
  const isToday = last.getTime() >= istDayStart(now).getTime();
  return { lastRequestedAt: last, nextAvailableAt: isToday ? nextIstDayStart(now) : null };
}

/** Latest requestedDate among the rows, in any order. */
export function latestRequestedAt(rows: { requestedDate: Date | string | null }[]): Date | null {
  let latest: Date | null = null;
  for (const row of rows) {
    if (!row.requestedDate) continue;
    const d = new Date(row.requestedDate);
    if (Number.isNaN(d.getTime())) continue;
    if (!latest || d > latest) latest = d;
  }
  return latest;
}

const istDateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "17 Nov 2026, 3:42 pm IST" */
export function formatIstDateTime(at: Date | string): string {
  return `${istDateTime.format(new Date(at))} IST`;
}
