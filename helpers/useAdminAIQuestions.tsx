import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminAIQuestionsList, type InputType as ListInputType } from "../endpoints/admin/ai-questions/list_GET.schema";
import { getAdminAIQuestionsStats } from "../endpoints/admin/ai-questions/stats_GET.schema";
import { postAdminUpdateAIQuestion, type InputType as UpdateInputType } from "../endpoints/admin/ai-questions/update_POST.schema";
import { postAdminDeleteAIQuestion, type InputType as DeleteInputType } from "../endpoints/admin/ai-questions/delete_POST.schema";
import { postAdminBulkDeleteAIQuestions, type InputType as BulkDeleteInputType } from "../endpoints/admin/ai-questions/bulk-delete_POST.schema";
import { postAdminBulkMarkReview, type InputType as BulkMarkReviewInputType } from "../endpoints/admin/ai-questions/bulk-mark-review_POST.schema";
import { postAdminBulkExportAIQuestions, type InputType as BulkExportInputType } from "../endpoints/admin/ai-questions/bulk-export_POST.schema";

export const AI_QUESTIONS_QUERY_KEY = "adminAIQuestions";

export const useAIQuestionsList = (params: ListInputType) => {
  return useQuery({
    queryKey: [AI_QUESTIONS_QUERY_KEY, "list", params],
    queryFn: () => getAdminAIQuestionsList(params),
  });
};

export const useAIQuestionsStats = () => {
  return useQuery({
    queryKey: [AI_QUESTIONS_QUERY_KEY, "stats"],
    queryFn: () => getAdminAIQuestionsStats(),
  });
};

export const useUpdateAIQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateInputType) => postAdminUpdateAIQuestion(data),
    onSuccess: () => {
      toast.success("Question updated successfully.");
      queryClient.invalidateQueries({ queryKey: [AI_QUESTIONS_QUERY_KEY, "list"] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update question.");
    },
  });
};

export const useDeleteAIQuestion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeleteInputType) => postAdminDeleteAIQuestion(data),
    onSuccess: () => {
      toast.success("Question deleted successfully.");
      queryClient.invalidateQueries({ queryKey: [AI_QUESTIONS_QUERY_KEY, "list"] });
      queryClient.invalidateQueries({ queryKey: [AI_QUESTIONS_QUERY_KEY, "stats"] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to delete question.");
    },
  });
};

export const useBulkDeleteAIQuestions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkDeleteInputType) => postAdminBulkDeleteAIQuestions(data),
    onSuccess: (result) => {
      toast.success(`${result.count} questions deleted successfully.`);
      queryClient.invalidateQueries({ queryKey: [AI_QUESTIONS_QUERY_KEY, "list"] });
      queryClient.invalidateQueries({ queryKey: [AI_QUESTIONS_QUERY_KEY, "stats"] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to delete questions.");
    },
  });
};

export const useBulkMarkReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkMarkReviewInputType) => postAdminBulkMarkReview(data),
    onSuccess: (result, variables) => {
      const action = variables.markForReview ? "marked for review" : "unmarked for review";
      toast.success(`${result.count} questions ${action}.`);
      queryClient.invalidateQueries({ queryKey: [AI_QUESTIONS_QUERY_KEY, "list"] });
      queryClient.invalidateQueries({ queryKey: [AI_QUESTIONS_QUERY_KEY, "stats"] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update review status.");
    },
  });
};

export const useBulkExportAIQuestions = () => {
  return useMutation({
    mutationFn: (data: BulkExportInputType) => postAdminBulkExportAIQuestions(data),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-questions-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export started successfully.");
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to export questions.");
    },
  });
};