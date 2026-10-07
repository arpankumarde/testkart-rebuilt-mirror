import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherCreatorBonusOverview } from "../endpoints/teacher/creator-bonus/overview_GET.schema";
import { getTeacherCreatorBonusCheck } from "../endpoints/teacher/creator-bonus/check_GET.schema";
import type { CampaignContentType } from "./teacherCampaignRules";

export const CREATOR_BONUS_QUERY_KEY = ["teacher", "creator-bonus"];

export function useCreatorBonusOverview() {
  return useQuery({
    queryKey: [...CREATOR_BONUS_QUERY_KEY, "overview"],
    queryFn: () => getTeacherCreatorBonusOverview(),
    refetchOnMount: true,
    staleTime: 30 * 1000,
  });
}

/** Whether a submit for review can carry the bonus claim. Fresh on every mount, since edits change it. */
export function useCreatorBonusCheck(type: CampaignContentType, id: number, enabled = true) {
  return useQuery({
    queryKey: [...CREATOR_BONUS_QUERY_KEY, "check", type, id],
    queryFn: () => getTeacherCreatorBonusCheck({ type, id }),
    enabled: enabled && Number.isFinite(id) && id > 0,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function useInvalidateCreatorBonus() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: CREATOR_BONUS_QUERY_KEY });
}