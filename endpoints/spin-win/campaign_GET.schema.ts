import { z } from "zod";
import superjson from "superjson";
import type { SpinViewState } from "../../helpers/spinWinViewer";
import type { SpinCampaignPhase } from "../../helpers/spinWinRules";

export const schema = z.object({
  slug: z.string().trim().min(1).max(120),
});

export type InputType = z.infer<typeof schema>;

export type SpinSegment = {
  rewardId: number;
  label: string;
  color: string;
  icon: string | null;
  /** The real odds, disclosed because the wheel's slices are equal-sized. */
  probability: number;
  /** What the slice pays out. */
  discountType: "percentage" | "flat" | null;
  discountValue: number | null;
};

export type OutputType = {
  campaign: {
    slug: string;
    name: string;
    description: string | null;
    bannerUrl: string | null;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    terms: string | null;
    phase: SpinCampaignPhase;
    allowGuestSpins: boolean;
    loginRequiredToSpin: boolean;
    eligibleCategories: string[];
    /** When coupons from this campaign expire. */
    couponExpiresAt: Date;
    maxDiscountPercent: number;
    popupEnabled: boolean;
    /** Seconds after landing before the popup opens on its own. */
    popupDelaySeconds: number;
  };
  segments: SpinSegment[];
  viewer: {
    loggedIn: boolean;
    role: string | null;
    canSpin: boolean;
    /** Why the viewer cannot spin, when they cannot and have not spun. */
    reason: string | null;
    spin: SpinViewState | null;
  };
};

export const getSpinWinCampaign = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(params);
  const result = await fetch(`/_api/spin-win/campaign?${new URLSearchParams(validated).toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};