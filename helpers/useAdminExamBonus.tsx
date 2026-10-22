import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAdminExamCampaigns } from "../endpoints/admin/content-reviews/exam-campaigns_GET.schema";
import { getAdminExamSearch } from "../endpoints/admin/content-reviews/exam-search_GET.schema";
import {
  postAdminExamCampaignSave,
  type InputType as SaveInput,
} from "../endpoints/admin/content-reviews/exam-campaign-save_POST.schema";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_EXAM_BONUS_QUERY_KEY = "admin-exam-bonus";

const SUCCESS_TITLES: Record<SaveInput["action"], string> = {
  start: "Exam Bonus started",
  edit: "Exam Bonus updated",
  end: "Exam Bonus ended",
};

export function useAdminExamCampaignsQuery() {
  return useQuery({
    queryKey: [ADMIN_EXAM_BONUS_QUERY_KEY, "campaigns"],
    queryFn: () => getAdminExamCampaigns(),
    refetchOnMount: true,
    staleTime: 30 * 1000,
  });
}

export function useAdminExamSearchQuery(search: string) {
  return useQuery({
    queryKey: [ADMIN_EXAM_BONUS_QUERY_KEY, "exam-search", search],
    queryFn: () => getAdminExamSearch({ search }),
    enabled: search.length >= 2,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminExamCampaignSave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveInput) => postAdminExamCampaignSave(input),
    onSuccess: (data, variables) => {
      toast.success(SUCCESS_TITLES[variables.action], { description: data.message });
    },
    onError: (error: unknown) => {
      toast.error("Could not save the Exam Bonus", { description: parseErrorMessage(error) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [ADMIN_EXAM_BONUS_QUERY_KEY] });
    },
  });
}