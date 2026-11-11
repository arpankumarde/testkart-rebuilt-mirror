/**
 * When autopay renewals are announced and charged.
 *
 * PayU's pre-debit API: for every mandate frequency other than daily and adhoc
 * (so every monthly UPI mandate here), the notice must reach PayU at least
 * 48 hours before the recurring charge, or the debit fails. A notice can be
 * sent at most 30 days ahead, and debitDate is a calendar date.
 *
 * The renewal job runs once a day at 06:00 IST, outside NPCI's peak hours. A
 * notice sent on IST day D names day D + NOTICE_LEAD_DAYS as its debit date,
 * and the charge runs on exactly that day, 72 hours after the notice. The debit
 * date is derived from preDebitSentAt, so no extra column is needed.
 */
export const NOTICE_MIN_LEAD_MS = 48 * 60 * 60 * 1000;
export const NOTICE_LEAD_DAYS = 3;

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** The IST calendar day (yyyy-mm-dd) a moment falls on. */
export function istDay(date: Date | string): string {
  return new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDaysToDay(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The moment an IST calendar day starts. */
export function istDayStart(day: string): Date {
  return new Date(`${day}T00:00:00+05:30`);
}

/** The debit date a notice sent at sentAt promised PayU. */
export function noticeDebitDate(sentAt: Date | string): string {
  return addDaysToDay(istDay(sentAt), NOTICE_LEAD_DAYS);
}

/** Send a notice for a renewal whose nextChargeDate is before this moment. */
export function noticeWindowEnd(now: Date): Date {
  return istDayStart(addDaysToDay(istDay(now), NOTICE_LEAD_DAYS + 1));
}

/** A renewal is due once its nextChargeDate is before the end of today in IST. */
export function dueBefore(now: Date): Date {
  return istDayStart(addDaysToDay(istDay(now), 1));
}

/** Notices sent before this moment name today, or an earlier day, as their debit date. */
export function noticesDueBefore(now: Date): Date {
  return istDayStart(addDaysToDay(istDay(now), 1 - NOTICE_LEAD_DAYS));
}

/** Notices sent before this moment named a debit date that has passed; they are void. */
export function noticesVoidBefore(now: Date): Date {
  return istDayStart(addDaysToDay(istDay(now), -NOTICE_LEAD_DAYS));
}

/** Why PayU would refuse a charge on this notice for being too soon, or null. */
export function noticeLeadRefusal(sentAt: Date | string | null, now: Date): string | null {
  if (!sentAt) {
    return "The pre-debit notice for this renewal has not been sent yet.";
  }
  if (now.getTime() - new Date(sentAt).getTime() < NOTICE_MIN_LEAD_MS) {
    return "PayU needs the pre-debit notice at least 48 hours before the charge.";
  }
  return null;
}

/** Why a renewal cannot be charged on this notice today, or null when today is its debit date. */
export function noticeChargeRefusal(sentAt: Date | string | null, now: Date): string | null {
  const leadRefusal = noticeLeadRefusal(sentAt, now);
  if (leadRefusal || !sentAt) return leadRefusal;
  const debitDate = noticeDebitDate(sentAt);
  const today = istDay(now);
  if (today < debitDate) {
    return `The pre-debit notice set this renewal for ${debitDate}.`;
  }
  if (today > debitDate) {
    return "The debit date in the pre-debit notice has passed. A new notice will be sent.";
  }
  return null;
}