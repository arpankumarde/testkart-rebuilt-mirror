import type { OutputType as CampaignView } from "../endpoints/spin-win/campaign_GET.schema";
import type { MySpinCoupon } from "../endpoints/spin-win/my-coupons_GET.schema";
import type { SpinViewState } from "./spinWinViewer";

/* Fixture data for the Spin & Win page examples only. Not real campaigns, students or codes. */

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

export const exampleCampaignView: CampaignView = {
  campaign: {
    slug: "diwali-2026",
    name: "Diwali Spin & Win 2026",
    description: "Spin. Win. Save on your prep.",
    bannerUrl: null,
    startsAt: new Date(now - DAY),
    endsAt: new Date(now + 10 * DAY),
    timezone: "Asia/Kolkata",
    terms: "Example terms. One spin per account for the whole campaign, or one per browser session when logged out.",
    phase: "active",
    allowGuestSpins: true,
    loginRequiredToSpin: false,
    eligibleCategories: ["test_series", "courses", "study_notes"],
    couponExpiresAt: new Date(now + 10 * DAY),
    maxDiscountPercent: 18,
    popupEnabled: true,
    popupDelaySeconds: 0,
  },
  segments: [
    { rewardId: 1, label: "5% OFF", color: "#E9DFF7", icon: "percent", probability: 30, discountType: "percentage", discountValue: 5 },
    { rewardId: 2, label: "10% OFF", color: "#D5F0E4", icon: "percent", probability: 25, discountType: "percentage", discountValue: 10 },
    { rewardId: 3, label: "15% OFF", color: "#F9DDE9", icon: "percent", probability: 12, discountType: "percentage", discountValue: 15 },
    { rewardId: 4, label: "18% OFF", color: "#DCEBFA", icon: "percent", probability: 5, discountType: "percentage", discountValue: 18 },
    { rewardId: 5, label: "₹50 OFF", color: "#FFF0BE", icon: "ticket", probability: 15, discountType: "flat", discountValue: 50 },
    { rewardId: 6, label: "₹100 OFF", color: "#FFF9F1", icon: "ticket", probability: 9, discountType: "flat", discountValue: 100 },
    { rewardId: 7, label: "₹150 OFF", color: "#DCEBFA", icon: "ticket", probability: 4, discountType: "flat", discountValue: 150 },
  ],
  viewer: { loggedIn: false, role: null, canSpin: true, reason: null, spin: null },
};

export const wonTenPercent: SpinViewState = {
  spinId: "1",
  rewardId: 2,
  wheelIndex: 1,
  rewardName: "10% OFF",
  wheelLabel: "10% OFF",
  rewardType: "percentage",
  discountType: "percentage",
  discountValue: 10,
  minOrderValue: null,
  maxDiscountAmount: null,
  eligibleCategories: ["test_series", "courses", "study_notes"],
  expiresAt: new Date(now + 10 * DAY),
  claimStatus: "unclaimed",
  requiresLogin: true,
  coupon: null,
};

export const exampleGuestWon: CampaignView = {
  ...exampleCampaignView,
  viewer: { loggedIn: false, role: null, canSpin: false, reason: null, spin: wonTenPercent },
};

export const exampleStudentClaimed: CampaignView = {
  ...exampleCampaignView,
  viewer: {
    loggedIn: true,
    role: "student",
    canSpin: false,
    reason: null,
    spin: {
      ...wonTenPercent,
      claimStatus: "claimed",
      requiresLogin: false,
      coupon: {
        code: "DIWALI-EXAMPLE1",
        discountType: "percentage",
        discountValue: 10,
        minOrderValue: 0,
        maxDiscountAmount: null,
        eligibleCategories: ["test_series", "courses", "study_notes"],
        expiresAt: new Date(now + 10 * DAY),
        status: "active",
      },
    },
  },
};

export const exampleStudentSession = {
  user: { id: 9001, email: "student@example.com", displayName: "Example Student", avatarUrl: null, role: "student" },
};

const base = {
  campaignName: "Diwali Spin & Win 2026",
  campaignSlug: "diwali-2026",
  eligibleCategories: ["test_series", "courses", "study_notes"],
  maxDiscountAmount: null,
  maxDiscountPercent: 18,
  issuedAt: new Date(now - DAY),
  expiresAt: new Date(now + 10 * DAY),
};

export const exampleCoupons: MySpinCoupon[] = [
  { ...base, id: 1, code: "DIWALI-EXAMPLE1", rewardName: "10% OFF", discountType: "percentage", discountValue: 10, minOrderValue: 0, status: "active", orderId: null, savedAmount: null },
  { ...base, id: 2, code: "DIWALI-EXAMPLE2", rewardName: "₹100 OFF", discountType: "flat", discountValue: 100, minOrderValue: 556, status: "active", orderId: null, savedAmount: null },
  { ...base, id: 3, code: "NEWYR-EXAMPLE3", campaignName: "Example earlier campaign", rewardName: "15% OFF", discountType: "percentage", discountValue: 15, minOrderValue: 0, status: "redeemed", orderId: 1234, savedAmount: 74.85 },
  { ...base, id: 4, code: "SUMMR-EXAMPLE4", campaignName: "Example summer campaign", rewardName: "₹50 OFF", discountType: "flat", discountValue: 50, minOrderValue: 278, status: "expired", orderId: null, savedAmount: null, expiresAt: new Date(now - 20 * DAY) },
];
