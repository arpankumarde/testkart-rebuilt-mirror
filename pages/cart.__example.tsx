import { defineScreens } from "@floot/examples";
import type { OutputType as Session } from "../endpoints/auth/session_GET.schema";
import type { OutputType as Cart, CartItem } from "../endpoints/cart/items_GET.schema";
import type { OutputType as Wallet } from "../endpoints/student/wallet/balance_GET.schema";
import type { OutputType as Tcoins } from "../endpoints/student/tcoins/summary_GET.schema";
import { exampleStudentSession } from "../helpers/spinWinExampleData";

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

const net20 = {
  promoCodeId: 160,
  code: "NET20",
  discountType: "percentage" as const,
  discountValue: 20,
  discountAmount: 399.8,
  eligibleCourseIds: [501],
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

export default defineScreens({
  backend: {
    "auth/session_GET": exampleStudentSession as Session,
    "student/wallet/balance_GET": wallet,
    "student/tcoins/summary_GET": tcoins,
    "spin-win/my-coupons_GET": { coupons: [] },
    "spin-win/active_GET": { active: null },
  },
  screens: [
    {
      title: "Teacher offer applied automatically",
      description: "A course with a public teacher coupon and a mock test: the offer discounts the course only",
      route: "/cart",
      backend: { "cart/items_GET": { items: [course, test], autoCoupon: net20 } satisfies Cart },
    },
    {
      title: "Two teachers, one offer",
      description: "Only one coupon works per order, so the cart gets the offer that saves the most",
      route: "/cart",
      backend: { "cart/items_GET": { items: [course, otherTeacherCourse], autoCoupon: net20 } satisfies Cart },
    },
    {
      title: "No offer",
      description: "No eligible teacher coupon: the regular price and the manual coupon box",
      route: "/cart",
      backend: {
        "cart/items_GET": { items: [otherTeacherCourse, test], autoCoupon: null } satisfies Cart,
        "promo-codes/validate_POST": {
          valid: true,
          discountAmount: 100,
          eligibleItemIds: [502],
          ineligibleItemIds: [77],
          promoCodeId: 900,
          message: "Promo code applied successfully!",
          discountBreakdown: "Applied to 1 out of 2 items in cart",
        },
      },
    },
  ],
});
