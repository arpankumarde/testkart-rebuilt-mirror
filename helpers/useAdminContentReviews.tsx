import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAdminContentReviews, InputType as ListInput } from "../endpoints/admin/content-reviews/list_GET.schema";
import { parseErrorMessage } from "./parseErrorMessage";
import { postReviewContent, InputType as ReviewInput } from "../endpoints/admin/content-reviews/review_POST.schema";

export const ADMIN_CONTENT_REVIEWS_QUERY_KEY = "admin-content-reviews";

const SUCCESS_TITLES: Record<ReviewInput["action"], string> = {
  approve: "Content approved successfully.",
  reject: "Content rejected successfully.",
  send_to_senior: "Sent for senior approval.",
  back_to_pending: "Moved back to pending.",
};

export function useAdminContentReviewsQuery(filters: ListInput = {}) {
  return useQuery({
    queryKey: [ADMIN_CONTENT_REVIEWS_QUERY_KEY, filters],
    queryFn: () => getAdminContentReviews(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    placeholderData: (prev) => prev,
  });
}

export function useReviewContentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ReviewInput) => postReviewContent(input),
    onSuccess: (data, variables) => {
      toast.success(SUCCESS_TITLES[variables.action], {
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: [ADMIN_CONTENT_REVIEWS_QUERY_KEY] });
    },
    onError: (error: unknown) => {
      toast.error("Action failed", {
        description: parseErrorMessage(error),
      });
      // The review may have been withdrawn or removed meanwhile, so the queue reloads either way.
      queryClient.invalidateQueries({ queryKey: [ADMIN_CONTENT_REVIEWS_QUERY_KEY] });
    },
  });
}