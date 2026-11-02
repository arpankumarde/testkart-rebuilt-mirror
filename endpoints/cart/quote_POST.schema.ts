import { z } from "zod";
import superjson from "superjson";
import type { CartAutoCoupon } from "../../helpers/courseCouponOffer";
import type { CouponSource, StackLineKind } from "../../helpers/cartCouponStack";

export const schema = z.object({
  /** The coupon the student chose, by id (from the coupon list) or by code (typed). */
  promoCodeId: z.number().int().positive().optional(),
  code: z.string().trim().min(1).max(64).optional(),
});

export type InputType = z.infer<typeof schema>;

export type QuoteTeacherOffer = CartAutoCoupon & { teacherName: string | null };

export type QuoteChosen = {
  promoCodeId: number;
  code: string;
  source: CouponSource;
  discountAmount: number;
  eligibleItems: Array<{ kind: StackLineKind; id: number }>;
  /** Courses whose automatic offer this teacher code replaces. Kept for older clients; see replacesAutoOnItems. */
  replacesAutoOn: number[];
  /** Every item (course or study note) whose automatic offer this teacher code replaces. */
  replacesAutoOnItems: Array<{ kind: StackLineKind; id: number }>;
};

/** A Testkart coupon the student can pick, priced against this cart after the teacher offers. */
export type QuoteCoupon = {
  promoCodeId: number;
  code: string;
  source: "spin" | "platform";
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderValue: number | null;
  maxDiscountAmount: number | null;
  /** Spin & Win categories (test_series, courses, study_notes); null for an admin code. */
  categories: string[] | null;
  appliesTo: string;
  expiresAt: Date | null;
  /** What it would take off, or null when it cannot apply (see reason). */
  estimate: number | null;
  reason: string | null;
};

/** One cart item as checkout will price it. */
export type QuoteLine = {
  kind: StackLineKind;
  id: number;
  /** The selling price before coupons: the sale price when valid, else the list price. */
  price: number;
  /** This item's share of its teacher offer (0 when none). */
  autoDiscount: number;
  /** The teacher offer behind autoDiscount. */
  autoCode: string | null;
  /** The item's price after its teacher offer. */
  priceAfterTeacher: number;
  /** This item's share of the chosen coupon, which is shown at order level. */
  chosenDiscount: number;
};

export type OutputType = {
  subtotal: number;
  lines: QuoteLine[];
  autoOffers: QuoteTeacherOffer[];
  teacherDiscount: number;
  chosen: QuoteChosen | null;
  /** Why the chosen coupon is not applied; the teacher offers still are. */
  chosenError: string | null;
  discountAmount: number;
  payable: number;
  coupons: QuoteCoupon[];
};

export const postCartQuote = async (body: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/cart/quote`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};
