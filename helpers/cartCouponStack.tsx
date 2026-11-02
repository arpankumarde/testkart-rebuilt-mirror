import {
  isAutoOfferKind,
  offerCoversLine,
  rankCartAutoCoupons,
  type CartAutoCoupon,
  type CartOfferLine,
  type CourseCouponCandidate,
} from "./courseCouponOffer";
import { promoCodeAppliesToItem, promoCodeCoversTeacher, type PromoItemType } from "./promoCodeEligibility";
import { promoDiscountFor } from "./promoCodeDiscount";
import { computeSpinDiscount, type SpinCouponTerms } from "./spinWinRules";

/*
 * How a cart's coupons stack. Pure: the server loads the rows, this prices them,
 * and the cart preview and all three checkouts share it.
 *
 * 1. Automatic teacher offers: a teacher's public coupon applies to their courses
 *    and study notes by itself, at most one offer per item (the one that takes
 *    the most off).
 * 2. One coupon the student chooses, priced on what is left after step 1:
 *    a Testkart coupon (admin-made or Spin & Win) is added on top, while a
 *    teacher code replaces the automatic offer on the items it covers, so no
 *    item ever carries two teacher discounts.
 * Payable = subtotal - teacher offers - chosen coupon.
 */

export type StackLineKind = "test" | "course" | "digitalProduct";

/** One cart line at its effective price (sale price when valid, else list price). */
export type StackLine = { kind: StackLineKind; id: number; teacherId: number | null; price: number };

export type StackPromo = {
  id: number;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minPurchaseAmount: number | null;
  maxDiscountAmount: number | null;
  appliesTo: string;
  targetItemIds: number[] | null;
  createdByTeacherId: number | null;
};

/** teacher = a code a teacher made; platform = an admin code; spin = a Spin & Win coupon. */
export type CouponSource = "teacher" | "platform" | "spin";

export type ChosenCoupon =
  | { source: "teacher" | "platform"; promo: StackPromo }
  | { source: "spin"; promo: StackPromo; spin: SpinCouponTerms };

export type StackedLine = StackLine & { key: string; autoDiscount: number; chosenDiscount: number };

export type StackedChosen = {
  promoCodeId: number;
  code: string;
  source: CouponSource;
  discountAmount: number;
  /** What the coupon was priced on: its eligible items after the teacher offers. */
  eligibleAmount: number;
  eligibleKeys: string[];
  /** Courses whose automatic offer this teacher code replaced. Kept for older clients; see replacesAutoOnKeys. */
  replacesAutoOn: number[];
  /** Line keys (course:1, digitalProduct:2) whose automatic offer this teacher code replaced. */
  replacesAutoOnKeys: string[];
};

export type StackedCoupons = {
  subtotal: number;
  autoOffers: CartAutoCoupon[];
  teacherDiscount: number;
  chosen: StackedChosen | null;
  /** Why the chosen coupon was not applied; the automatic offers still are. */
  chosenError: string | null;
  /** True when the chosen code is one of the automatic offers, so there is nothing to add. */
  chosenAlreadyAuto: boolean;
  discountAmount: number;
  payable: number;
  lines: StackedLine[];
};

const roundPaise = (amount: number) => Math.round(amount * 100) / 100;
const rupees = (amount: number) => `₹${roundPaise(amount).toLocaleString("en-IN")}`;

export const lineKey = (line: { kind: StackLineKind; id: number }) => `${line.kind}:${line.id}`;

const PROMO_ITEM_TYPE: Record<StackLineKind, PromoItemType> = {
  test: "test",
  course: "course",
  digitalProduct: "digital_product",
};

export function promoCoversLine(promo: StackPromo, line: StackLine): boolean {
  return (
    promoCodeAppliesToItem(promo, PROMO_ITEM_TYPE[line.kind], line.id) &&
    promoCodeCoversTeacher(promo.createdByTeacherId, line.teacherId)
  );
}

/** Spreads an amount over lines by weight, to the paisa; the largest line takes the rounding so shares add up exactly. */
export function spreadDiscount(amount: number, weights: Array<{ key: string; weight: number }>): Map<string, number> {
  const shares = new Map<string, number>();
  const live = weights.filter((w) => w.weight > 0);
  const total = live.reduce((sum, w) => sum + w.weight, 0);
  if (!(amount > 0) || total <= 0) return shares;
  let given = 0;
  for (const w of live) {
    const share = roundPaise((amount * w.weight) / total);
    shares.set(w.key, share);
    given += share;
  }
  const largest = live.reduce((a, b) => (b.weight > a.weight ? b : a));
  shares.set(largest.key, roundPaise((shares.get(largest.key) ?? 0) + amount - given));
  return shares;
}

/** The automatic offers for a cart: best offer first, then the best for the items still uncovered, and so on. */
export function pickAutoOffers(candidates: CourseCouponCandidate[], lines: StackLine[]): CartAutoCoupon[] {
  let remaining: CartOfferLine[] = lines.flatMap((l) =>
    isAutoOfferKind(l.kind) && l.price > 0 ? [{ kind: l.kind, id: l.id, teacherId: l.teacherId, price: l.price }] : []
  );
  let pool = [...candidates];
  const offers: CartAutoCoupon[] = [];
  while (remaining.length > 0 && pool.length > 0) {
    const [best] = rankCartAutoCoupons(pool, remaining);
    if (!best) break;
    offers.push(best);
    remaining = remaining.filter((l) => !offerCoversLine(best, l));
    pool = pool.filter((c) => c.id !== best.promoCodeId);
  }
  return offers;
}

type NetLine = StackLine & { key: string; auto: number; net: number };

type ChosenPricing =
  | { ok: true; discount: number; eligible: NetLine[]; eligibleAmount: number }
  | { ok: false; message: string };

const AFTER_TEACHER = "Teacher offers come off first, and this coupon is checked on the price after them.";

function priceChosen(chosen: ChosenCoupon, lines: NetLine[]): ChosenPricing {
  if (chosen.source === "spin") {
    const result = computeSpinDiscount(
      chosen.spin,
      lines.map((l) => ({ type: l.kind, id: l.id, price: l.net }))
    );
    const eligible = lines.filter((l) => result.eligible.some((e) => e.type === l.kind && e.id === l.id));
    if (!result.ok) {
      const afterTeacher = eligible.some((l) => l.auto > 0);
      return { ok: false, message: afterTeacher ? `${result.message} ${AFTER_TEACHER}` : result.message };
    }
    if (!(result.discount > 0)) return { ok: false, message: "This coupon gives no discount on this cart." };
    return { ok: true, discount: result.discount, eligible, eligibleAmount: result.eligibleAmount };
  }

  const covered = lines.filter((l) => l.price > 0 && promoCoversLine(chosen.promo, l));
  const eligible = covered.filter((l) => l.net > 0);
  if (eligible.length === 0) {
    return {
      ok: false,
      message: covered.length > 0
        ? "The items this coupon covers are already free after the teacher offer."
        : "This promo code is not valid for any items in your cart.",
    };
  }
  const eligibleAmount = roundPaise(eligible.reduce((sum, l) => sum + l.net, 0));
  const min = chosen.promo.minPurchaseAmount;
  if (min !== null && eligibleAmount < min) {
    const afterTeacher = eligible.some((l) => l.auto > 0);
    return {
      ok: false,
      message: afterTeacher
        ? `This coupon needs eligible items worth at least ${rupees(min)}. Yours come to ${rupees(eligibleAmount)} after the teacher discount. ${AFTER_TEACHER}`
        : `A minimum purchase of ${rupees(min)} is required for eligible items. Yours come to ${rupees(eligibleAmount)}.`,
    };
  }
  const discount = promoDiscountFor(chosen.promo, eligibleAmount);
  if (discount === null) return { ok: false, message: "This coupon gives no discount on this cart." };
  return { ok: true, discount, eligible, eligibleAmount };
}

function withAutoShares(lines: StackLine[], offers: CartAutoCoupon[]): NetLine[] {
  const auto = new Map<string, number>();
  for (const offer of offers) {
    const covered = lines.filter((l) => offerCoversLine(offer, l));
    for (const [key, share] of spreadDiscount(offer.discountAmount, covered.map((l) => ({ key: lineKey(l), weight: l.price })))) {
      auto.set(key, roundPaise((auto.get(key) ?? 0) + share));
    }
  }
  return lines.map((l) => {
    const key = lineKey(l);
    const share = auto.get(key) ?? 0;
    return { ...l, key, auto: share, net: roundPaise(Math.max(0, l.price - share)) };
  });
}

export function priceCouponStack(input: {
  lines: StackLine[];
  autoCandidates: CourseCouponCandidate[];
  chosen: ChosenCoupon | null;
}): StackedCoupons {
  const { lines, autoCandidates } = input;
  const subtotal = roundPaise(lines.reduce((sum, l) => sum + l.price, 0));
  const autoAll = pickAutoOffers(autoCandidates, lines);

  let chosen = input.chosen;
  let chosenError: string | null = null;
  let chosenAlreadyAuto = false;
  if (chosen && autoAll.some((o) => o.promoCodeId === chosen!.promo.id)) {
    chosenError = `${chosen.promo.code} is already applied automatically.`;
    chosenAlreadyAuto = true;
    chosen = null;
  }

  let autoOffers = autoAll;
  let replacesAutoOnKeys: string[] = [];
  if (chosen?.source === "teacher") {
    const teacherCode = chosen.promo;
    const covered = new Set(lines.filter((l) => l.price > 0 && promoCoversLine(teacherCode, l)).map(lineKey));
    autoOffers = pickAutoOffers(
      autoCandidates.filter((c) => c.id !== teacherCode.id),
      lines.filter((l) => !covered.has(lineKey(l)))
    );
    replacesAutoOnKeys = lines.filter((l) => covered.has(lineKey(l)) && autoAll.some((o) => offerCoversLine(o, l))).map(lineKey);
  }

  let netLines = withAutoShares(lines, autoOffers);
  let stackedChosen: StackedChosen | null = null;
  let chosenShares = new Map<string, number>();

  if (chosen) {
    const priced = priceChosen(chosen, netLines);
    if (priced.ok) {
      chosenShares = spreadDiscount(priced.discount, priced.eligible.map((l) => ({ key: l.key, weight: l.net })));
      stackedChosen = {
        promoCodeId: chosen.promo.id,
        code: chosen.promo.code,
        source: chosen.source,
        discountAmount: priced.discount,
        eligibleAmount: priced.eligibleAmount,
        eligibleKeys: priced.eligible.map((l) => l.key),
        replacesAutoOn: replacesAutoOnKeys.filter((key) => key.startsWith("course:")).map((key) => Number(key.slice("course:".length))),
        replacesAutoOnKeys,
      };
    } else {
      chosenError = priced.message;
      if (autoOffers !== autoAll) {
        autoOffers = autoAll;
        netLines = withAutoShares(lines, autoOffers);
      }
    }
  }

  const teacherDiscount = roundPaise(autoOffers.reduce((sum, o) => sum + o.discountAmount, 0));
  const discountAmount = roundPaise(teacherDiscount + (stackedChosen?.discountAmount ?? 0));
  return {
    subtotal,
    autoOffers,
    teacherDiscount,
    chosen: stackedChosen,
    chosenError,
    chosenAlreadyAuto,
    discountAmount,
    payable: roundPaise(Math.max(0, subtotal - discountAmount)),
    lines: netLines.map(({ net: _net, auto, ...line }) => ({
      ...line,
      autoDiscount: auto,
      chosenDiscount: chosenShares.get(line.key) ?? 0,
    })),
  };
}
