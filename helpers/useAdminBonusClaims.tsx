import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAdminBonusClaims, type InputType as ListInput } from "../endpoints/admin/content-reviews/bonus-claims_GET.schema";
import { postAdminBonusDecide, type InputType as DecideInput } from "../endpoints/admin/content-reviews/bonus-decide_POST.schema";
import { ADMIN_CONTENT_REVIEWS_QUERY_KEY } from "./useAdminContentReviews";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_BONUS_CLAIMS_QUERY_KEY = "admin-bonus-claims";

const SUCCESS_TITLES: Record<DecideInput["action"], string> = {
  credit: "Bonus credited",
  decline: "Bonus declined",
  reverse: "Bonus reversed",
};

export function useAdminBonusClaimsQuery(filters: ListInput) {
  return useQuery({
    queryKey: [ADMIN_BONUS_CLAIMS_QUERY_KEY, filters],
    queryFn: () => getAdminBonusClaims(filters),
    placeholderData: (prev) => prev,
    refetchOnMount: true,
    staleTime: 30 * 1000,
  });
}

export function useAdminBonusDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DecideInput) => postAdminBonusDecide(input),
    onSuccess: (data, variables) => {
      toast.success(SUCCESS_TITLES[variables.action], { description: data.message });
    },
    onError: (error: unknown) => {
      toast.error("Could not save the decision", { description: parseErrorMessage(error) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_BONUS_CLAIMS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [ADMIN_CONTENT_REVIEWS_QUERY_KEY] });
    },
  });
}