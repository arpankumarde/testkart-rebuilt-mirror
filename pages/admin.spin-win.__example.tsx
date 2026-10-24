import { defineScreens, httpError, pending } from "@floot/examples";
import type { OutputType as CampaignsOutput } from "../endpoints/admin/spin-win/campaigns_GET.schema";

const session = {
  admin: { id: 1, email: "marketing@testkart.in", fullName: "Marketing Admin", role: "admin", permissions: ["spin_win"] },
};

const stamp = new Date("2026-11-01T09:30:00Z");

const base = {
  description: null,
  bannerUrl: null,
  timezone: "Asia/Kolkata",
  terms: null,
  allowGuestSpins: true,
  loginRequiredToSpin: false,
  maxTotalSpins: null,
  claimDeadline: null,
  redemptionDeadline: null,
  eligibleCategories: ["test_series", "courses", "study_notes"],
  maxDiscountPercent: 18,
  discountFunding: "current_split",
  popupEnabled: true,
  popupDelaySeconds: 6,
  createdAt: stamp,
  updatedAt: stamp,
};

const days = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 5 + i));
  const live = i >= 26;
  return {
    day: d.toISOString().slice(0, 10),
    spins: live ? [280, 361, 402, 308][i - 26] : 0,
    userSpins: live ? [190, 240, 270, 202][i - 26] : 0,
    guestSpins: live ? [90, 121, 132, 106][i - 26] : 0,
    coupons: 0,
    redemptions: 0,
    revenue: 0,
    discount: 0,
  };
});

const loaded: CampaignsOutput = {
  campaigns: [
    {
      ...base,
      id: 1,
      name: "Diwali Spin & Win 2026",
      slug: "diwali-2026",
      startsAt: new Date("2026-10-31T18:30:00Z"),
      endsAt: new Date("2026-11-15T18:29:00Z"),
      status: "published",
      phase: "active",
      spins: 1351,
      coupons: 1104,
      redeemed: 286,
      activeRewards: 7,
      probabilityTotal: 100,
    },
    {
      ...base,
      id: 2,
      name: "New Year Spin 2027",
      slug: "new-year-2027",
      startsAt: new Date("2026-12-31T18:30:00Z"),
      endsAt: new Date("2027-01-07T18:29:00Z"),
      status: "draft",
      phase: "draft",
      spins: 0,
      coupons: 0,
      redeemed: 0,
      activeRewards: 0,
      probabilityTotal: 0,
    },
  ],
  range: { startDay: "2026-10-05", endDay: "2026-11-03" },
  stats: { totalSpins: 1351, uniqueParticipants: 1288, userSpins: 902, guestSpins: 449, claimed: 1104, unclaimed: 230, forfeited: 17, couponsGenerated: 1104, couponsRedeemed: 286, orders: 286, revenue: 241830, discount: 27410, firstTimeBuyers: 171, repeatBuyers: 22 },
  finance: { originalValue: 269240, discount: 27410, studentPaid: 241830, commissionOnOriginal: 75387, commissionOnPaid: 67712, teacherPayoutCurrent: 174118, teacherPayoutProposed: 193853, marginCurrent: 67712, marginProposed: 47977 },
  daily: days,
};

const empty: CampaignsOutput = {
  ...loaded,
  campaigns: [],
  stats: { totalSpins: 0, uniqueParticipants: 0, userSpins: 0, guestSpins: 0, claimed: 0, unclaimed: 0, forfeited: 0, couponsGenerated: 0, couponsRedeemed: 0, orders: 0, revenue: 0, discount: 0, firstTimeBuyers: 0, repeatBuyers: 0 },
  finance: { originalValue: 0, discount: 0, studentPaid: 0, commissionOnOriginal: 0, commissionOnPaid: 0, teacherPayoutCurrent: 0, teacherPayoutProposed: 0, marginCurrent: 0, marginProposed: 0 },
  daily: days.map((d) => ({ ...d, spins: 0, userSpins: 0, guestSpins: 0 })),
};

export default defineScreens({
  backend: {
    "admin/session_GET": session,
    "admin/dashboard/overview_GET": pending,
  },
  screens: [
    { title: "Campaigns", backend: { "admin/spin-win/campaigns_GET": loaded } },
    { title: "No campaigns yet", backend: { "admin/spin-win/campaigns_GET": empty } },
    { title: "Loading", backend: { "admin/spin-win/campaigns_GET": pending } },
    { title: "Load failed", backend: { "admin/spin-win/campaigns_GET": httpError(500) } },
  ],
});
