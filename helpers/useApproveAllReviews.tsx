import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postApproveAllReviews } from "../endpoints/admin/content-reviews/approve-all_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { ADMIN_CONTENT_REVIEWS_QUERY_KEY } from "./useAdminContentReviews";

export const useApproveAllReviews = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await postApproveAllReviews();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      // Invalidate the reviews query so the UI reflects the changes
      queryClient.invalidateQueries({ queryKey: [ADMIN_CONTENT_REVIEWS_QUERY_KEY] });
    },
    onError: (error) => {
      toast.error(
        parseErrorMessage(error) ||  "Failed to approve all reviews"
      );
    },
  });
};