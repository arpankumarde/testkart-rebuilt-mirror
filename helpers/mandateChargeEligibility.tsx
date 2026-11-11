import { istDay, noticeChargeRefusal } from "./renewalNoticeSchedule";

export type MandateChargeCandidate = {
  status: string;
  autoRenew: boolean | null;
  mandateId: string | null;
  mandateStatus: string | null;
  nextChargeDate: Date | string | null;
  preDebitSentAt: Date | string | null;
};

/**
 * Why a subscription cannot be charged against its mandate right now, or null
 * when it can. Mirrors the Phase 2 charge query in helpers/subscriptionRenew, so
 * a renewal triggered from the browser never charges what the scheduled job
 * would skip - a cancelled or expired plan, or one whose pre-debit notice has
 * not gone out or whose debit date is not today.
 */
export function getMandateChargeRefusal(
  subscription: MandateChargeCandidate,
  now: Date = new Date()
): string | null {
  if (subscription.status !== "active" || !subscription.autoRenew) {
    return "This subscription is not set to renew automatically.";
  }
  if (!subscription.mandateId || subscription.mandateStatus !== "active") {
    return "No active mandate found for this subscription.";
  }
  if (!subscription.nextChargeDate || istDay(subscription.nextChargeDate) > istDay(now)) {
    return "Subscription is not yet due for renewal.";
  }
  return noticeChargeRefusal(subscription.preDebitSentAt, now);
}
