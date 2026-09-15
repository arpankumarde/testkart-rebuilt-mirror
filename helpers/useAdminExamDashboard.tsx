import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminExamDashboard } from "../endpoints/admin/exam-dashboard/list_GET.schema";
import {
  postAdminBulkUpdateExams,
  type InputType as BulkUpdateExamsInput,
} from "../endpoints/admin/exams/bulk-update_POST.schema";

export const ADMIN_EXAM_DASHBOARD_QUERY_KEY = ["admin", "exam-dashboard"];

export const useAdminExamDashboardQuery = () => {
  return useQuery({
    queryKey: ADMIN_EXAM_DASHBOARD_QUERY_KEY,
    queryFn: () => getAdminExamDashboard(),
    // The app default never refetches on mount. This list does once an exam
    // content write has invalidated it, so its status filters are not stale.
    refetchOnMount: true,
  });
};

export const useBulkUpdateExamsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkUpdateExamsInput) => postAdminBulkUpdateExams(data),
    onSuccess: (result) => {
      toast.success(
        `Updated ${result.updatedCount} exam${result.updatedCount === 1 ? "" : "s"}.`
      );
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_DASHBOARD_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin", "exam-categories"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "exams"] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update exams.");
    },
  });
};