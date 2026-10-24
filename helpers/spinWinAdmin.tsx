import superjson from "superjson";
import type { Selectable } from "kysely";
import { db } from "./db";
import { ForbiddenError, getAdminServerSessionOrThrow, NotAuthenticatedError, type AdminProfile } from "./getAdminSession";
import type { SpinCampaignRewards, SpinCampaigns } from "./schema";
import {
  probabilityProblems,
  rewardTermsProblems,
  spinCampaignPhase,
  type SpinCampaignPhase,
  type SpinDiscountType,
  type SpinRewardType,
} from "./spinWinRules";

export type AdminSpinCampaign = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  status: string;
  phase: SpinCampaignPhase;
  terms: string | null;
  allowGuestSpins: boolean;
  loginRequiredToSpin: boolean;
  maxTotalSpins: number | null;
  claimDeadline: Date | null;
  redemptionDeadline: Date | null;
  eligibleCategories: string[];
  maxDiscountPercent: number;
  discountFunding: string;
  popupEnabled: boolean;
  popupDelaySeconds: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminSpinReward = {
  id: number;
  campaignId: number;
  name: string;
  rewardType: SpinRewardType;
  description: string | null;
  discountType: SpinDiscountType | null;
  discountValue: number | null;
  wheelLabel: string;
  segmentColor: string;
  icon: string | null;
  imageUrl: string | null;
  probability: number;
  minOrderValue: number | null;
  maxDiscountAmount: number | null;
  quantityLimit: number | null;
  activatesAt: Date | null;
  isActive: boolean;
  sortOrder: number;
  spins: number;
};

const num = (value: string | number | null): number | null => (value === null ? null : Number(value));

export function toAdminCampaign(row: Selectable<SpinCampaigns>): AdminSpinCampaign {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    bannerUrl: row.bannerUrl,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    status: row.status,
    phase: spinCampaignPhase(row),
    terms: row.terms,
    allowGuestSpins: row.allowGuestSpins,
    loginRequiredToSpin: row.loginRequiredToSpin,
    maxTotalSpins: row.maxTotalSpins,
    claimDeadline: row.claimDeadline,
    redemptionDeadline: row.redemptionDeadline,
    eligibleCategories: row.eligibleCategories,
    maxDiscountPercent: Number(row.maxDiscountPercent),
    discountFunding: row.discountFunding,
    popupEnabled: row.popupEnabled,
    popupDelaySeconds: row.popupDelaySeconds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toAdminReward(row: Selectable<SpinCampaignRewards>, spins = 0): AdminSpinReward {
  return {
    id: row.id,
    campaignId: row.campaignId,
    name: row.name,
    rewardType: row.rewardType as SpinRewardType,
    description: row.description,
    discountType: row.discountType as SpinDiscountType | null,
    discountValue: num(row.discountValue),
    wheelLabel: row.wheelLabel,
    segmentColor: row.segmentColor,
    icon: row.icon,
    imageUrl: row.imageUrl,
    probability: Number(row.probability),
    minOrderValue: num(row.minOrderValue),
    maxDiscountAmount: num(row.maxDiscountAmount),
    quantityLimit: row.quantityLimit,
    activatesAt: row.activatesAt,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    spins,
  };
}

export async function loadCampaignOrThrow(id: number) {
  const campaign = await db.selectFrom("spinCampaigns").selectAll().where("id", "=", id).executeTakeFirst();
  if (!campaign) throw new Error("Campaign not found.");
  return campaign;
}

export async function loadRewards(campaignId: number): Promise<AdminSpinReward[]> {
  const rows = await db
    .selectFrom("spinCampaignRewards as r")
    .selectAll("r")
    .select((eb) =>
      eb
        .selectFrom("spinRecords as s")
        .select(eb.fn.countAll<string>().as("n"))
        .whereRef("s.rewardId", "=", "r.id")
        .as("spins")
    )
    .where("r.campaignId", "=", campaignId)
    .orderBy("r.sortOrder", "asc")
    .orderBy("r.id", "asc")
    .execute();
  return rows.map((row) => toAdminReward(row, Number(row.spins ?? 0)));
}

/** Everything that blocks a campaign from going live. Empty means it can be published. */
export function publishProblems(campaign: Selectable<SpinCampaigns>, rewards: AdminSpinReward[]): string[] {
  const problems = probabilityProblems(rewards);
  const maxPercent = Number(campaign.maxDiscountPercent);
  for (const reward of rewards.filter((r) => r.isActive)) {
    for (const problem of rewardTermsProblems(reward, maxPercent)) problems.push(`${reward.name}: ${problem}`);
  }
  if (new Date(campaign.endsAt) <= new Date()) problems.push("The end date has passed.");
  return problems;
}

/** Live campaigns must keep a valid wheel after every edit. Drafts may be saved half-done. */
export const isLiveStatus = (status: string) => status === "published" || status === "paused";

/**
 * Runs an admin handler: checks the admin session (module rules come from helpers/adminPermissions),
 * and maps failures to the status codes the admin pages expect.
 */
export async function runAdminSpin(request: Request, fn: (admin: AdminProfile) => Promise<unknown>): Promise<Response> {
  try {
    const admin = await getAdminServerSessionOrThrow(request);
    const result = await fn(admin);
    return result instanceof Response ? result : new Response(superjson.stringify(result));
  } catch (error) {
    const status = error instanceof NotAuthenticatedError ? 401 : error instanceof ForbiddenError ? 403 : 400;
    if (status === 400) console.error("Spin & Win admin error:", error);
    return new Response(superjson.stringify({ error: error instanceof Error ? error.message : "Request failed" }), { status });
  }
}
