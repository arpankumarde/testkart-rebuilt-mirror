/**
 * Spin & Win rules shared by the server and the admin UI. Nothing here touches the database;
 * the allocation, claim and checkout code lives in helpers/spinWinServer.
 *
 * A campaign's reward rows define what can be won. Issuing a coupon creates a promo_codes row
 * (single use, admin-owned, never public) plus a spin_coupons row that binds it to the student
 * and snapshots the discount terms, so the existing checkout engine redeems it and
 * spinWinServer.getSpinCouponRuleOrThrow adds the campaign-only checks.
 */

export const SPIN_CATEGORIES = ["test_series", "courses", "study_notes"] as const;
export type SpinCategory = (typeof SPIN_CATEGORIES)[number];

export const SPIN_CATEGORY_LABELS: Record<SpinCategory, string> = {
  test_series: "Test series",
  courses: "Courses",
  study_notes: "Study notes",
};

/** Hard ceiling from the PRD; the database enforces it too. */
export const SPIN_MAX_DISCOUNT_PERCENT = 18;

export const SPIN_REWARD_TYPES = ["percentage", "flat", "grand_prize", "other"] as const;
export type SpinRewardType = (typeof SPIN_REWARD_TYPES)[number];

export const SPIN_REWARD_TYPE_LABELS: Record<SpinRewardType, string> = {
  percentage: "Percentage off",
  flat: "Flat off",
  grand_prize: "Grand Prize",
  other: "Other",
};

export type SpinDiscountType = "percentage" | "flat";

/** Stored admin intent. What a viewer sees comes from spinCampaignPhase. */
export const SPIN_CAMPAIGN_STATUSES = ["draft", "published", "paused", "completed"] as const;
export type SpinCampaignStatus = (typeof SPIN_CAMPAIGN_STATUSES)[number];

export type SpinCampaignPhase = "draft" | "scheduled" | "active" | "paused" | "completed" | "expired";

export const SPIN_PHASE_LABELS: Record<SpinCampaignPhase, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  expired: "Expired",
};

export function spinCampaignPhase(
  campaign: { status: string; startsAt: Date | string; endsAt: Date | string },
  now: Date = new Date()
): SpinCampaignPhase {
  if (campaign.status === "draft") return "draft";
  if (campaign.status === "paused") return "paused";
  if (campaign.status === "completed") return "completed";
  if (now < new Date(campaign.startsAt)) return "scheduled";
  if (now >= new Date(campaign.endsAt)) return "expired";
  return "active";
}

export const SPIN_COUPON_STATUSES = ["active", "reserved", "redeemed", "expired", "void"] as const;
export type SpinCouponStatus = (typeof SPIN_COUPON_STATUSES)[number];

export const SPIN_COUPON_STATUS_LABELS: Record<SpinCouponStatus, string> = {
  active: "Active",
  reserved: "In checkout",
  redeemed: "Redeemed",
  expired: "Expired",
  void: "Void",
};

export const SPIN_CLAIM_STATUS_LABELS: Record<string, string> = {
  unclaimed: "Unclaimed",
  claimed: "Claimed",
  forfeited: "Forfeited",
};

/** Probabilities are stored to 3 decimals; totals are compared in thousandths to dodge float drift. */
export const toMilli = (value: number | string | null | undefined): number => Math.round(Number(value ?? 0) * 1000);

export function activeProbabilityTotal(rewards: { isActive: boolean; probability: number | string }[]): number {
  return rewards.filter((r) => r.isActive).reduce((sum, r) => sum + toMilli(r.probability), 0) / 1000;
}

export function probabilityProblems(
  rewards: { name: string; isActive: boolean; probability: number | string }[]
): string[] {
  const problems: string[] = [];
  const active = rewards.filter((r) => r.isActive);
  if (active.length === 0) problems.push("Turn on at least one reward.");
  const total = active.reduce((sum, r) => sum + toMilli(r.probability), 0);
  if (total !== 100000) problems.push(`Active probabilities add up to ${total / 1000}%, not 100%.`);
  for (const r of active) {
    if (toMilli(r.probability) <= 0) problems.push(`${r.name} is on with a 0% chance. Give it a chance or turn it off.`);
  }
  return problems;
}

/** Minimum eligible cart for a flat reward so it never passes the percentage cap: discount / 0.18, rounded up. */
export function flatMinimumOrder(discount: number, maxPercent: number = SPIN_MAX_DISCOUNT_PERCENT): number {
  return Math.ceil(discount / (maxPercent / 100));
}

export type SpinRewardTerms = {
  discountType: SpinDiscountType | null;
  discountValue: number | null;
  minOrderValue: number | null;
  maxDiscountAmount: number | null;
};

/** Checks a reward's discount terms against the campaign cap. Returns problems, empty when fine. */
export function rewardTermsProblems(
  reward: SpinRewardTerms & { rewardType: SpinRewardType },
  maxPercent: number
): string[] {
  const problems: string[] = [];
  const { rewardType, discountType, discountValue, minOrderValue } = reward;
  if (rewardType === "percentage" && discountType !== "percentage") problems.push("A percentage reward needs a percentage discount.");
  if (rewardType === "flat" && discountType !== "flat") problems.push("A flat reward needs a flat discount.");
  if (discountType && !(discountValue && discountValue > 0)) problems.push("Enter a discount value above 0.");
  if (discountType === "percentage" && discountValue && discountValue > maxPercent) {
    problems.push(`Percentage discounts can be at most ${maxPercent}%.`);
  }
  if (discountType === "flat" && discountValue) {
    const needed = flatMinimumOrder(discountValue, maxPercent);
    if (minOrderValue === null || minOrderValue < needed) {
      problems.push(`A ₹${discountValue} discount needs a minimum eligible order of at least ₹${needed} to stay within ${maxPercent}%.`);
    }
  }
  return problems;
}

export type SpinLineType = "test" | "course" | "digitalProduct" | "bundle" | "live_test";

const LINE_CATEGORY: Record<SpinLineType, SpinCategory | null> = {
  test: "test_series",
  course: "courses",
  digitalProduct: "study_notes",
  bundle: null,
  live_test: null,
};

export type SpinCheckoutLine = { type: SpinLineType; id: number; price: number };

export type SpinCouponTerms = {
  discountType: SpinDiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscountAmount: number | null;
  maxDiscountPercent: number;
  eligibleCategories: string[];
};

export type SpinDiscountResult =
  | { ok: true; eligible: SpinCheckoutLine[]; eligibleAmount: number; discount: number }
  | { ok: false; message: string; eligible: SpinCheckoutLine[] };

const listCategories = (categories: string[]) =>
  categories.map((c) => SPIN_CATEGORY_LABELS[c as SpinCategory] ?? c).join(", ").toLowerCase();

/**
 * The discount a spin coupon gives a cart, from server-side prices only. Only lines in the
 * coupon's categories count; the eligible total must reach the minimum; the discount is capped by
 * the coupon's own cap and by max_discount_percent of the eligible total, and floored to paise so
 * it can never exceed the percentage cap.
 */
export function computeSpinDiscount(terms: SpinCouponTerms, lines: SpinCheckoutLine[]): SpinDiscountResult {
  const eligible = lines.filter((line) => {
    const category = LINE_CATEGORY[line.type];
    return category !== null && terms.eligibleCategories.includes(category);
  });
  if (eligible.length === 0) {
    return { ok: false, eligible, message: `This Spin & Win coupon works only on ${listCategories(terms.eligibleCategories)}.` };
  }
  const eligibleAmount = Math.round(eligible.reduce((sum, line) => sum + line.price, 0) * 100) / 100;
  if (eligibleAmount < terms.minOrderValue) {
    return {
      ok: false,
      eligible,
      message: `This coupon needs eligible items worth at least ₹${terms.minOrderValue}. Your eligible items come to ₹${eligibleAmount}.`,
    };
  }
  let discount = terms.discountType === "percentage" ? (eligibleAmount * terms.discountValue) / 100 : terms.discountValue;
  if (terms.maxDiscountAmount !== null) discount = Math.min(discount, terms.maxDiscountAmount);
  discount = Math.min(discount, (eligibleAmount * terms.maxDiscountPercent) / 100, eligibleAmount);
  discount = Math.floor(discount * 100) / 100;
  return { ok: true, eligible, eligibleAmount, discount };
}

export const SPIN_SEGMENT_COLORS = [
  "#E9DFF7",
  "#D5F0E4",
  "#F9DDE9",
  "#DCEBFA",
  "#FFF0BE",
  "#FFF9F1",
  "#D5F0E4",
  "#F9DDE9",
];

export type SpinRewardPreset = {
  name: string;
  rewardType: SpinRewardType;
  discountType: SpinDiscountType | null;
  discountValue: number | null;
  wheelLabel: string;
  minOrderValue: number | null;
  icon: string;
};

/**
 * The PRD's Diwali wheel. Probabilities start at 0% and every reward starts off: the split is a
 * business decision, and the Grand Prize benefit is still undecided, so it carries no discount.
 */
export const DIWALI_REWARD_PRESETS: SpinRewardPreset[] = [
  { name: "5% OFF", rewardType: "percentage", discountType: "percentage", discountValue: 5, wheelLabel: "5% OFF", minOrderValue: 10, icon: "percent" },
  { name: "10% OFF", rewardType: "percentage", discountType: "percentage", discountValue: 10, wheelLabel: "10% OFF", minOrderValue: 10, icon: "percent" },
  { name: "15% OFF", rewardType: "percentage", discountType: "percentage", discountValue: 15, wheelLabel: "15% OFF", minOrderValue: 10, icon: "percent" },
  { name: "18% OFF", rewardType: "percentage", discountType: "percentage", discountValue: 18, wheelLabel: "18% OFF", minOrderValue: 10, icon: "percent" },
  { name: "₹50 OFF", rewardType: "flat", discountType: "flat", discountValue: 50, wheelLabel: "₹50 OFF", minOrderValue: 278, icon: "ticket" },
  { name: "₹100 OFF", rewardType: "flat", discountType: "flat", discountValue: 100, wheelLabel: "₹100 OFF", minOrderValue: 556, icon: "ticket" },
  { name: "₹150 OFF", rewardType: "flat", discountType: "flat", discountValue: 150, wheelLabel: "₹150 OFF", minOrderValue: 834, icon: "ticket" },
  { name: "Grand Prize", rewardType: "grand_prize", discountType: null, discountValue: null, wheelLabel: "Grand Prize", minOrderValue: null, icon: "gift" },
];

/** Milliseconds a zone is ahead of UTC at an instant. */
function zoneOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** A datetime-local value ("2026-11-01T09:00") read as wall time in the campaign's zone. */
export function zonedInputToDate(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const first = wall - zoneOffset(wall, timeZone);
  return new Date(wall - zoneOffset(first, timeZone));
}

export function dateToZonedInput(date: Date | string | null | undefined, timeZone: string): string {
  if (!date) return "";
  const instant = new Date(date).getTime();
  return new Date(instant + zoneOffset(instant, timeZone)).toISOString().slice(0, 16);
}

export function formatInZone(date: Date | string | null | undefined, timeZone: string): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function durationLabel(start: Date | string, end: Date | string): string {
  const hours = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 3600000);
  if (hours < 48) return `${hours} hours`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}

export function discountLabel(type: string | null, value: number | null): string {
  if (!type || value === null) return "No discount";
  return type === "percentage" ? `${value}% off` : `₹${value} off`;
}

export const SPIN_FUNDING_LABELS: Record<string, string> = {
  current_split: "Current split (discount shared pro rata)",
  platform_funded: "Testkart-funded (proposed, pending finance approval)",
};
