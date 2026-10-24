import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminSpinCampaigns, type InputType as CampaignsInput } from "../endpoints/admin/spin-win/campaigns_GET.schema";
import { getAdminSpinCampaign } from "../endpoints/admin/spin-win/campaign_GET.schema";
import { postAdminSpinCampaignSave, type InputType as CampaignSaveInput } from "../endpoints/admin/spin-win/campaign-save_POST.schema";
import { postAdminSpinCampaignStatus, type InputType as CampaignStatusInput } from "../endpoints/admin/spin-win/campaign-status_POST.schema";
import { postAdminSpinCampaignDelete } from "../endpoints/admin/spin-win/campaign-delete_POST.schema";
import { postAdminSpinRewardSave, type InputType as RewardSaveInput } from "../endpoints/admin/spin-win/reward-save_POST.schema";
import { postAdminSpinRewardDelete } from "../endpoints/admin/spin-win/reward-delete_POST.schema";
import { postAdminSpinProbabilities, type InputType as ProbabilitiesInput } from "../endpoints/admin/spin-win/probabilities_POST.schema";
import { getAdminSpinSpins, type InputType as SpinsInput } from "../endpoints/admin/spin-win/spins_GET.schema";
import { getAdminSpinCoupons, type InputType as CouponsInput } from "../endpoints/admin/spin-win/coupons_GET.schema";
import { getAdminSpinCoupon } from "../endpoints/admin/spin-win/coupon_GET.schema";
import { postAdminSpinCouponVoid, type InputType as CouponVoidInput } from "../endpoints/admin/spin-win/coupon-void_POST.schema";
import { getAdminSpinAnalytics, type InputType as AnalyticsInput } from "../endpoints/admin/spin-win/analytics_GET.schema";

const ROOT = ["admin", "spinWin"] as const;

export const spinWinKeys = {
  all: ROOT,
  campaigns: (input: CampaignsInput) => [...ROOT, "campaigns", input] as const,
  campaign: (id: number) => [...ROOT, "campaign", id] as const,
  spins: (input: SpinsInput) => [...ROOT, "spins", input] as const,
  coupons: (input: CouponsInput) => [...ROOT, "coupons", input] as const,
  coupon: (id: number) => [...ROOT, "coupon", id] as const,
  analytics: (input: AnalyticsInput) => [...ROOT, "analytics", input] as const,
};

export const useSpinCampaigns = (input: CampaignsInput) =>
  useQuery({ queryKey: spinWinKeys.campaigns(input), queryFn: () => getAdminSpinCampaigns(input), placeholderData: keepPreviousData });

export const useSpinCampaign = (id: number | null) =>
  useQuery({ queryKey: spinWinKeys.campaign(id ?? 0), queryFn: () => getAdminSpinCampaign({ id: id! }), enabled: id !== null });

export const useSpinSpins = (input: SpinsInput) =>
  useQuery({ queryKey: spinWinKeys.spins(input), queryFn: () => getAdminSpinSpins(input), placeholderData: keepPreviousData });

export const useSpinCoupons = (input: CouponsInput) =>
  useQuery({ queryKey: spinWinKeys.coupons(input), queryFn: () => getAdminSpinCoupons(input), placeholderData: keepPreviousData });

export const useSpinCoupon = (id: number | null) =>
  useQuery({ queryKey: spinWinKeys.coupon(id ?? 0), queryFn: () => getAdminSpinCoupon({ id: id! }), enabled: id !== null });

export const useSpinAnalytics = (input: AnalyticsInput) =>
  useQuery({ queryKey: spinWinKeys.analytics(input), queryFn: () => getAdminSpinAnalytics(input), placeholderData: keepPreviousData });

/** Every Spin & Win write refreshes every Spin & Win read; the screens are small and share counts. */
function useSpinMutation<TInput, TOutput>(fn: (input: TInput) => Promise<TOutput>, success?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROOT });
      if (success) toast.success(success);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
}

export const useSaveSpinCampaign = () => useSpinMutation((input: CampaignSaveInput) => postAdminSpinCampaignSave(input), "Campaign saved");

const STATUS_TOASTS: Record<CampaignStatusInput["action"], string> = {
  publish: "Campaign published",
  pause: "Campaign paused",
  resume: "Campaign resumed",
  complete: "Campaign completed",
  unpublish: "Campaign moved back to draft",
};

export function useSpinCampaignStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CampaignStatusInput) => postAdminSpinCampaignStatus(input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ROOT });
      toast.success(STATUS_TOASTS[input.action]);
    },
    onError: (error) => toast.error(parseErrorMessage(error)),
  });
}

export const useDeleteSpinCampaign = () => useSpinMutation((id: number) => postAdminSpinCampaignDelete({ id }), "Campaign deleted");
export const useSaveSpinReward = () => useSpinMutation((input: RewardSaveInput) => postAdminSpinRewardSave(input), "Reward saved");
export const useDeleteSpinReward = () => useSpinMutation((id: number) => postAdminSpinRewardDelete({ id }), "Reward deleted");
export const useSaveSpinProbabilities = () =>
  useSpinMutation((input: ProbabilitiesInput) => postAdminSpinProbabilities(input), "Probabilities saved");
export const useVoidSpinCoupon = () => useSpinMutation((input: CouponVoidInput) => postAdminSpinCouponVoid(input), "Coupon voided");
