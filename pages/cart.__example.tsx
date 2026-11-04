import superjson from "superjson";
import { defineScreens } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Cart, CartItem } from "../endpoints/cart/items_GET.schema";
import type { OutputType as Quote, QuoteCoupon } from "../endpoints/cart/quote_POST.schema";
import type { OutputType as Wallet } from "../endpoints/student/wallet/balance_GET.schema";
import type { OutputType as Tcoins } from "../endpoints/student/tcoins/summary_GET.schema";
import { exampleStudentSession } from "../helpers/spinWinExampleData";
import { lineKey, priceCouponStack, type ChosenCoupon, type StackLine } from "../helpers/cartCouponStack";
import { offerCoversLine, type CourseCouponCandidate } from "../helpers/courseCouponOffer";

const course: CartItem = {
  type: "course",
  cartItemId: 1,
  courseId: 501,
  slug: "ugc-net-paper-1-complete-course-2026",
  title: "UGC NET Paper 1 Complete Course 2026",
  price: 1999,
  discountPrice: null,
  thumbnailUrl: null,
  thumbnailImageUrl: null,
  teacherName: "Example Teacher",
};

const otherTeacherCourse: CartItem = {
  ...course,
  cartItemId: 2,
  courseId: 502,
  slug: "physics-foundation",
  title: "Physics Foundation",
  price: 1499,
  discountPrice: 1199,
  teacherName: "Another Teacher",
};

const test: CartItem = {
  type: "test",
  cartItemId: 3,
  mockTestId: 77,
  slug: "ugc-net.paper-1-mocks",
  title: "UGC NET Paper 1 Mock Tests",
  price: 299,
  discountPrice: 199,
  thumbnailUrl: null,
  creatorName: "Example Teacher",
};

const pyqCourse: CartItem = {
  ...course,
  cartItemId: 4,
  courseId: 503,
  slug: "ugc-net-paper-1-pyq-batch",
  title: "UGC NET Paper 1 PYQ Batch",
  price: 999,
};

const notes: CartItem = {
  type: "digitalProduct",
  cartItemId: 5,
  digitalProductId: 88,
  slug: "ugc-net-paper-1-notes",
  title: "UGC NET Paper 1 Handwritten Notes",
  price: 249,
  discountPrice: null,
  thumbnailUrl: null,
  teacherName: "Another Teacher",
};

const TEACHER_OF: Record<string, number> = { "course:501": 7, "course:502": 9, "course:503": 7, "test:77": 7, "digitalProduct:88": 9 };
const TEACHER_NAMES: Record<number, string> = { 7: "Example Teacher", 9: "Another Teacher" };

const linesOf = (items: CartItem[]): StackLine[] =>
  items.map((item) => {
    const kind = item.type;
    const id = item.type === "test" ? item.mockTestId : item.type === "course" ? item.courseId : item.digitalProductId;
    return { kind, id, teacherId: TEACHER_OF[lineKey({ kind, id })] ?? null, price: item.discountPrice ?? item.price };
  });

const teacherCoupon = (id: number, code: string, teacherId: number, discountValue: number): CourseCouponCandidate => ({
  id,
  code,
  discountType: "percentage",
  discountValue,
  minPurchaseAmount: null,
  maxDiscountAmount: 600,
  appliesTo: "all",
  targetItemIds: null,
  validFrom: new Date(0),
  createdByTeacherId: teacherId,
  validUntil: null,
});

const net20 = teacherCoupon(160, "NET20", 7, 20);
const phy10 = teacherCoupon(161, "PHY10", 9, 10);

const spinCoupon = (id: number, code: string, discountValue: number, minOrderValue: number): ChosenCoupon => ({
  source: "spin",
  promo: {
    id,
    code,
    discountType: "percentage",
    discountValue,
    minPurchaseAmount: null,
    maxDiscountAmount: null,
    appliesTo: "all",
    targetItemIds: null,
    createdByTeacherId: null,
  },
  spin: {
    discountType: "percentage",
    discountValue,
    minOrderValue,
    maxDiscountAmount: null,
    maxDiscountPercent: 18,
    eligibleCategories: ["test_series", "courses", "study_notes"],
  },
});

const diwali10 = spinCoupon(950, "DIWALI-N4JBG7CR", 10, 10);
const diwali15 = spinCoupon(951, "DIWALI-K2PL9QXA", 15, 2500);
const save100: ChosenCoupon = {
  source: "platform",
  promo: {
    id: 900,
    code: "SAVE100",
    discountType: "fixed",
    discountValue: 100,
    minPurchaseAmount: 500,
    maxDiscountAmount: null,
    appliesTo: "all",
    targetItemIds: null,
    createdByTeacherId: null,
  },
};

/** Answers cart/quote with the real stacking rules, so the screens show what checkout would charge. */
const quoteFixture =
  (items: CartItem[], candidates: CourseCouponCandidate[], pickable: ChosenCoupon[], typed: ChosenCoupon[] = []) =>
  async (request: Request): Promise<Quote> => {
    const body = superjson.parse<{ promoCodeId?: number; code?: string }>(await request.text()) ?? {};
    const lines = linesOf(items);
    const all = [...pickable, ...typed];
    const picked = all.find((c) => c.promo.id === body.promoCodeId || c.promo.code === body.code) ?? null;
    const asked = body.promoCodeId || body.code;
    const stack = priceCouponStack({ lines, autoCandidates: candidates, chosen: picked });
    const coupons: QuoteCoupon[] = pickable.map((c) => {
      const priced = priceCouponStack({ lines, autoCandidates: candidates, chosen: c });
      return {
        promoCodeId: c.promo.id,
        code: c.promo.code,
        source: c.source === "spin" ? "spin" : "platform",
        discountType: c.promo.discountType,
        discountValue: c.promo.discountValue,
        minOrderValue: c.source === "spin" ? c.spin.minOrderValue : c.promo.minPurchaseAmount,
        maxDiscountAmount: c.promo.maxDiscountAmount,
        categories: c.source === "spin" ? c.spin.eligibleCategories : null,
        appliesTo: c.promo.appliesTo,
        expiresAt: new Date("2026-11-15T18:29:59Z"),
        estimate: priced.chosen?.discountAmount ?? null,
        reason: priced.chosen ? null : priced.chosenError,
      };
    });
    const itemOfKey = (key: string) => {
      const [kind, id] = key.split(":");
      return { kind: kind as StackLine["kind"], id: Number(id) };
    };
    return {
      subtotal: stack.subtotal,
      lines: stack.lines.map((l) => ({
        kind: l.kind,
        id: l.id,
        price: l.price,
        autoDiscount: l.autoDiscount,
        autoCode: l.autoDiscount > 0 ? stack.autoOffers.find((o) => offerCoversLine(o, l))?.code ?? null : null,
        priceAfterTeacher: Math.round((l.price - l.autoDiscount) * 100) / 100,
        chosenDiscount: l.chosenDiscount,
      })),
      autoOffers: stack.autoOffers.map((o) => ({ ...o, teacherName: TEACHER_NAMES[o.teacherId] ?? null })),
      teacherDiscount: stack.teacherDiscount,
      chosen: stack.chosen
        ? {
            promoCodeId: stack.chosen.promoCodeId,
            code: stack.chosen.code,
            source: stack.chosen.source,
            discountAmount: stack.chosen.discountAmount,
            eligibleItems: stack.chosen.eligibleKeys.map(itemOfKey),
            replacesAutoOn: stack.chosen.replacesAutoOn,
            replacesAutoOnItems: stack.chosen.replacesAutoOnKeys.map(itemOfKey),
          }
        : null,
      chosenError: asked && !picked ? "Invalid promo code." : stack.chosenError,
      discountAmount: stack.discountAmount,
      payable: stack.payable,
      coupons,
    };
  };

const cartOf = (items: CartItem[], candidates: CourseCouponCandidate[]): Cart => {
  const { autoOffers } = priceCouponStack({ lines: linesOf(items), autoCandidates: candidates, chosen: null });
  return { items, autoCoupon: autoOffers[0] ?? null, autoCoupons: autoOffers };
};

const wallet: Wallet = {
  availableBalance: 0,
  totalCredits: 0,
  totalWithdrawn: 0,
  totalPurchased: 0,
  breakdown: { credits: { count: 0, amount: 0 }, withdrawals: { count: 0, amount: 0 }, purchases: { count: 0, amount: 0 } },
};

const tcoins: Tcoins = {
  enabled: true,
  redeemPercent: 10,
  maxRedeem: 100,
  cashbackPercent: 2,
  maxCashback: 50,
  balance: 120,
  pendingCashback: 0,
  totalEarned: 120,
  totalSpent: 0,
  history: [],
};

const vip40: ChosenCoupon = {
  source: "teacher",
  promo: { ...save100.promo, id: 170, code: "VIP40", discountType: "percentage", discountValue: 40, minPurchaseAmount: null, createdByTeacherId: 7 },
};

export default defineScreens({
  backend: {
    "auth/session_GET": exampleStudentSession as Session,
    "student/wallet/balance_GET": wallet,
    "student/tcoins/summary_GET": tcoins,
    "spin-win/active_GET": { active: null },
  },
  screens: [
    {
      title: "Teacher offer plus a Testkart coupon",
      description: "NET20 applies by itself; open View available coupons and apply the Spin & Win coupon on top",
      route: "/cart",
      backend: {
        "cart/items_GET": cartOf([course, test], [net20]),
        "cart/quote_POST": quoteFixture([course, test], [net20], [diwali10, diwali15], [vip40]),
      },
    },
    {
      title: "Two courses, one teacher",
      description: "NET20 on both courses from the same teacher, each with its own share, plus notes without a discount",
      route: "/cart",
      backend: {
        "cart/items_GET": cartOf([course, pyqCourse, notes], [net20]),
        "cart/quote_POST": quoteFixture([course, pyqCourse, notes], [net20], [diwali10, diwali15], [save100]),
      },
    },
    {
      title: "Two teachers, two offers",
      description: "Each teacher's coupon applies to their own course; one Testkart coupon can still be added",
      route: "/cart",
      backend: {
        "cart/items_GET": cartOf([course, otherTeacherCourse], [net20, phy10]),
        "cart/quote_POST": quoteFixture([course, otherTeacherCourse], [net20, phy10], [diwali10, diwali15]),
      },
    },
    {
      title: "No teacher offer",
      description: "Only Testkart coupons; type SAVE100 or pick one from the list",
      route: "/cart",
      backend: {
        "cart/items_GET": cartOf([otherTeacherCourse, test], []),
        "cart/quote_POST": quoteFixture([otherTeacherCourse, test], [], [diwali10], [save100]),
      },
    },
  ],
});
