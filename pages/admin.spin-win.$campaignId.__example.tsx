import { defineScreens, pending } from "@floot/examples";
import type { OutputType as CampaignOutput } from "../endpoints/admin/spin-win/campaign_GET.schema";
import type { OutputType as CouponsOutput } from "../endpoints/admin/spin-win/coupons_GET.schema";
import type { OutputType as SpinsOutput } from "../endpoints/admin/spin-win/spins_GET.schema";
import type { OutputType as AnalyticsOutput } from "../endpoints/admin/spin-win/analytics_GET.schema";
import type { AdminSpinReward } from "../helpers/spinWinAdmin";
import { DIWALI_REWARD_PRESETS, SPIN_SEGMENT_COLORS } from "../helpers/spinWinRules";

const session = {
  admin: { id: 1, email: "marketing@testkart.in", fullName: "Marketing Admin", role: "admin", permissions: ["spin_win"] },
};

const stamp = new Date("2026-11-01T09:30:00Z");
const odds = [30, 25, 15, 5, 12, 8, 5, 0];
const won = [412, 340, 198, 61, 170, 104, 66, 0];

const rewards: AdminSpinReward[] = DIWALI_REWARD_PRESETS.map((p, i) => ({
  id: i + 1,
  campaignId: 1,
  name: p.name,
  rewardType: p.rewardType,
  description: null,
  discountType: p.discountType,
  discountValue: p.discountValue,
  wheelLabel: p.wheelLabel,
  segmentColor: SPIN_SEGMENT_COLORS[i],
  icon: p.icon,
  imageUrl: null,
  probability: odds[i],
  minOrderValue: p.minOrderValue,
  maxDiscountAmount: null,
  quantityLimit: null,
  activatesAt: p.rewardType === "grand_prize" ? new Date("2026-11-08T18:30:00Z") : null,
  isActive: p.rewardType !== "grand_prize",
  sortOrder: i,
  spins: won[i],
}));

const campaign = {
  id: 1,
  name: "Diwali Spin & Win 2026",
  slug: "diwali-2026",
  description: "Spin. Win. Save on your prep.",
  bannerUrl: null,
  startsAt: new Date("2026-10-31T18:30:00Z"),
  endsAt: new Date("2026-11-15T18:29:00Z"),
  timezone: "Asia/Kolkata",
  status: "published",
  phase: "active" as const,
  terms: "One spin per account for the whole campaign, or one per browser session when logged out.\nOdds: 5% OFF 30%, 10% OFF 25%, 15% OFF 15%, 18% OFF 5%, ₹50 OFF 12%, ₹100 OFF 8%, ₹150 OFF 5%.",
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

const detail: CampaignOutput = {
  campaign,
  rewards,
  probabilityTotal: 100,
  problems: [],
  spins: won.reduce((a, b) => a + b, 0),
  audit: [
    { id: "3", adminName: "Marketing Admin", entity: "reward", entityId: null, action: "probabilities_updated", before: null, after: null, createdAt: stamp },
    { id: "2", adminName: "Marketing Admin", entity: "campaign", entityId: "1", action: "publish", before: { status: "draft" }, after: { status: "published" }, createdAt: stamp },
    { id: "1", adminName: "Marketing Admin", entity: "campaign", entityId: "1", action: "created_with_diwali_presets", before: null, after: null, createdAt: stamp },
  ],
};

const draft: CampaignOutput = {
  ...detail,
  campaign: { ...campaign, status: "draft", phase: "draft" },
  rewards: rewards.map((r) => ({ ...r, probability: 0, isActive: false, spins: 0 })),
  probabilityTotal: 0,
  problems: ["Turn on at least one reward.", "Active probabilities add up to 0%, not 100%."],
  spins: 0,
};

const coupons: CouponsOutput = {
  rows: [
    { id: 3, code: "DIWALI-K7Q2MX9P", userId: 5012, studentName: "Ananya Sharma", studentEmail: "ananya@example.com", studentMobile: null, rewardName: "₹100 OFF", rewardType: "flat", discountType: "flat", discountValue: 100, minOrderValue: 556, maxDiscountAmount: null, campaignId: 1, campaignName: campaign.name, status: "redeemed", issuedAt: stamp, expiresAt: campaign.endsAt, orderId: 88123 },
    { id: 2, code: "DIWALI-3HZ8WQ4T", userId: 5007, studentName: "Rohit Verma", studentEmail: null, studentMobile: "98xxxxxx21", rewardName: "15% OFF", rewardType: "percentage", discountType: "percentage", discountValue: 15, minOrderValue: 0, maxDiscountAmount: null, campaignId: 1, campaignName: campaign.name, status: "active", issuedAt: stamp, expiresAt: campaign.endsAt, orderId: null },
    { id: 1, code: "DIWALI-P2N6VB8R", userId: 4990, studentName: "Meera Iyer", studentEmail: "meera@example.com", studentMobile: null, rewardName: "5% OFF", rewardType: "percentage", discountType: "percentage", discountValue: 5, minOrderValue: 0, maxDiscountAmount: null, campaignId: 1, campaignName: campaign.name, status: "reserved", issuedAt: stamp, expiresAt: campaign.endsAt, orderId: 88120 },
  ],
  total: 3,
  page: 1,
  pageSize: 25,
};

const spins: SpinsOutput = {
  rows: [
    { id: "41", campaignId: 1, campaignName: campaign.name, userId: 5012, studentName: "Ananya Sharma", studentEmail: "ananya@example.com", studentMobile: null, spunAs: "user", sessionRef: null, spunAt: stamp, rewardName: "₹100 OFF", claimStatus: "claimed", claimedAt: stamp, forfeitReason: null, couponCode: "DIWALI-K7Q2MX9P", couponStatus: "redeemed" },
    { id: "40", campaignId: 1, campaignName: campaign.name, userId: null, studentName: null, studentEmail: null, studentMobile: null, spunAs: "guest", sessionRef: "aZ81kQ3x", spunAt: stamp, rewardName: "10% OFF", claimStatus: "unclaimed", claimedAt: null, forfeitReason: null, couponCode: null, couponStatus: null },
    { id: "39", campaignId: 1, campaignName: campaign.name, userId: null, studentName: null, studentEmail: null, studentMobile: null, spunAs: "guest", sessionRef: "Lm4p9Wd2", spunAt: stamp, rewardName: "5% OFF", claimStatus: "forfeited", claimedAt: null, forfeitReason: "account_already_spun", couponCode: null, couponStatus: null },
  ],
  total: 3,
  page: 1,
  pageSize: 25,
};

const days = Array.from({ length: 4 }, (_, i) => `2026-11-0${i + 1}`);
const analytics: AnalyticsOutput = {
  range: { startDay: "2026-11-01", endDay: "2026-11-04" },
  stats: { totalSpins: 1351, uniqueParticipants: 1288, userSpins: 902, guestSpins: 449, claimed: 1104, unclaimed: 230, forfeited: 17, couponsGenerated: 1104, couponsRedeemed: 286, orders: 286, revenue: 241830, discount: 27410, firstTimeBuyers: 171, repeatBuyers: 22 },
  finance: { originalValue: 269240, discount: 27410, studentPaid: 241830, commissionOnOriginal: 75387, commissionOnPaid: 67712, teacherPayoutCurrent: 174118, teacherPayoutProposed: 193853, marginCurrent: 67712, marginProposed: 47977 },
  daily: days.map((day, i) => ({ day, spins: [280, 361, 402, 308][i], userSpins: [190, 240, 270, 202][i], guestSpins: [90, 121, 132, 106][i], coupons: [220, 300, 330, 254][i], redemptions: [40, 71, 98, 77][i], revenue: [33100, 60120, 82300, 66310][i], discount: [3800, 6900, 9200, 7510][i] })),
  rewards: rewards.map((r, i) => ({ rewardId: r.id, campaignId: 1, name: r.name, rewardType: r.rewardType, segmentColor: r.segmentColor, spins: won[i], claimed: Math.round(won[i] * 0.82), coupons: Math.round(won[i] * 0.82), redeemed: Math.round(won[i] * 0.21), discount: [1200, 2900, 3800, 1700, 1250, 1600, 1500, 0][i] * 2, revenue: [42000, 50500, 40100, 12800, 30200, 33400, 32830, 0][i] })),
  typeCosts: [
    { rewardType: "percentage", redemptions: 213, discount: 19200 },
    { rewardType: "flat", redemptions: 73, discount: 8210 },
    { rewardType: "grand_prize", redemptions: 0, discount: 0 },
  ],
  discountFunding: "current_split",
};

export default defineScreens({
  backend: {
    "admin/session_GET": session,
    "admin/dashboard/overview_GET": pending,
    "admin/spin-win/campaign_GET": detail,
    "admin/spin-win/coupons_GET": coupons,
    "admin/spin-win/spins_GET": spins,
    "admin/spin-win/analytics_GET": analytics,
  },
  screens: [
    { title: "Rewards (live)", route: "/admin/spin-win/1?tab=rewards" },
    { title: "Rewards (new draft)", route: "/admin/spin-win/1?tab=rewards", backend: { "admin/spin-win/campaign_GET": draft } },
    { title: "Coupons", route: "/admin/spin-win/1?tab=coupons" },
    { title: "Spin history", route: "/admin/spin-win/1?tab=spins" },
    { title: "Analytics", route: "/admin/spin-win/1?tab=analytics" },
    { title: "Finance", route: "/admin/spin-win/1?tab=finance" },
    { title: "Settings", route: "/admin/spin-win/1?tab=settings" },
  ],
});
