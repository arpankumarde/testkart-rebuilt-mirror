import { Kysely, Transaction } from "kysely";
import { db } from "./db";
import { DB } from "./schema";

/**
 * Intro offer: a teacher's first-ever paid autopay sign-up to Starter or
 * Individual (monthly billing only) is charged ₹1 instead of the plan price
 * for the first cycle. The mandate itself is still authorized up to the real
 * plan price, so the second and later cycles renew at the normal rate through
 * the existing autopay renewal job without any special-casing there.
 *
 * The offer never stacks with a promo code: when it applies, the first charge
 * is exactly ₹1, any code is ignored and not redeemed, and renewals are the
 * full plan price. Every surface (plan cards, confirm dialog, promo check,
 * mandate creation) decides eligibility through the helpers in this file.
 */
export const INTRO_OFFER_PRICE = 1;
const INTRO_OFFER_PLAN_NAMES = ["Starter Plan", "Individual Plan"];

export const INTRO_OFFER_PROMO_CONFLICT =
  "Your ₹1 first-month offer already applies to this plan, so a promo code can't be added to it.";

export function planQualifiesForIntroOffer(planName: string, billingCycle: string): boolean {
  return INTRO_OFFER_PLAN_NAMES.includes(planName) && billingCycle === "monthly";
}

/**
 * Launch promo: for two weeks after launch, the ₹1 offer is also open to a
 * teacher who had a paid plan before but isn't on an active one right now
 * (lapsed, cancelled or expired) — not just a teacher who never paid at all.
 * After this date, eligibility automatically reverts to "never had any paid
 * subscription, ever" (the normal, permanent rule below).
 */
const LAUNCH_PROMO_ENDS_AT = new Date("2026-11-01T00:00:00+05:30");

/**
 * Normal rule: true if this teacher has never had a paid (price > 0)
 * subscription row of any status. Checked regardless of status so cancelling
 * and resubscribing cannot be used to claim the intro price more than once.
 *
 * During the launch promo window above, this is relaxed to: true if the
 * teacher has no currently ACTIVE paid subscription — a lapsed past
 * subscriber qualifies again, but someone already on a paid plan does not.
 */
export async function isEligibleForIntroOffer(
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<boolean> {
  const queryBuilder = trx ?? db;
  const now = new Date();

  if (now <= LAUNCH_PROMO_ENDS_AT) {
    const activePaidSubscription = await queryBuilder
      .selectFrom("teacherSubscriptions")
      .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
      .select("teacherSubscriptions.id")
      .where("teacherSubscriptions.teacherId", "=", teacherId)
      .where("teacherSubscriptions.status", "=", "active")
      .where("teacherSubscriptions.endDate", ">", now)
      .where("subscriptionPlans.price", ">", "0")
      .limit(1)
      .executeTakeFirst();
    return !activePaidSubscription;
  }

  const priorPaidSubscription = await queryBuilder
    .selectFrom("teacherSubscriptions")
    .innerJoin("subscriptionPlans", "subscriptionPlans.id", "teacherSubscriptions.planId")
    .select("teacherSubscriptions.id")
    .where("teacherSubscriptions.teacherId", "=", teacherId)
    .where("subscriptionPlans.price", ">", "0")
    .limit(1)
    .executeTakeFirst();
  return !priorPaidSubscription;
}

/** True when this teacher's autopay sign-up to this plan is charged ₹1 for the first cycle. */
export async function introOfferAppliesToPlan(
  plan: { name: string; billingCycle: string },
  teacherId: number,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<boolean> {
  return planQualifiesForIntroOffer(plan.name, plan.billingCycle) && (await isEligibleForIntroOffer(teacherId, trx));
}

/**
 * Ids of the active plans this teacher would get for ₹1 right now. Empty
 * outside recurring (autopay) mode, where the offer does not exist.
 */
export async function getIntroOfferPlanIds(
  teacherId: number,
  paymentMode: string,
  trx?: Transaction<DB> | Kysely<DB>
): Promise<number[]> {
  if (paymentMode !== "recurring") return [];
  const queryBuilder = trx ?? db;
  if (!(await isEligibleForIntroOffer(teacherId, queryBuilder))) return [];
  const plans = await queryBuilder
    .selectFrom("subscriptionPlans")
    .select(["id", "name", "billingCycle"])
    .where("isActive", "=", true)
    .execute();
  return plans.filter((plan) => planQualifiesForIntroOffer(plan.name, plan.billingCycle)).map((plan) => plan.id);
}