import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { ADMIN_EXAM_DASHBOARD_QUERY_KEY } from "./useAdminExamDashboard";
import { getAdminExamContentList, type InputType as ListInput } from "../endpoints/admin/exam-content/list_GET.schema";
import { postAdminUpsertExamContent, type InputType as UpsertInput } from "../endpoints/admin/exam-content/upsert_POST.schema";
import { postAdminGenerateExamContent, type InputType as GenerateInput } from "../endpoints/admin/exam-content/generate_POST.schema";
import { postAdminPublishExamContent, type InputType as PublishInput } from "../endpoints/admin/exam-content/publish_POST.schema";
import { postAdminUnpublishExamContent, type InputType as UnpublishInput } from "../endpoints/admin/exam-content/unpublish_POST.schema";
import {
  postAdminExamContentReadyForReview,
  type InputType as ReadyForReviewInput,
} from "../endpoints/admin/exam-content/ready-for-review_POST.schema";

const ADMIN_EXAM_CONTENT_QUERY_KEY = ["admin", "exam-content"];

// The exam list shows section status, ready-for-review marks and last edit
// dates, so every write here also marks it stale.
const invalidateExamContent = (queryClient: QueryClient, examId: number) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: [...ADMIN_EXAM_CONTENT_QUERY_KEY, examId] }),
    queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_DASHBOARD_QUERY_KEY }),
  ]);

export const useAdminExamContentQuery = (examId: number | null) => {
  return useQuery({
    queryKey: [...ADMIN_EXAM_CONTENT_QUERY_KEY, examId],
    queryFn: () => getAdminExamContentList({ examId: examId as number }),
    enabled: examId !== null,
  });
};

export const useUpsertExamContentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertInput) => postAdminUpsertExamContent(data),
    onSuccess: (_, variables) => {
      toast.success("Draft saved.");
      invalidateExamContent(queryClient, variables.examId);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to save draft.");
    },
  });
};

export const useGenerateExamContentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GenerateInput) => postAdminGenerateExamContent(data),
    onSuccess: (_, variables) => {
      toast.success("AI draft generated - review before publishing.");
      invalidateExamContent(queryClient, variables.examId);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to generate content.");
    },
  });
};

export const usePublishExamContentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PublishInput) => postAdminPublishExamContent(data),
    onSuccess: (_, variables) => {
      toast.success("Published.");
      invalidateExamContent(queryClient, variables.examId);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to publish.");
    },
  });
};

export const useUnpublishExamContentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UnpublishInput) => postAdminUnpublishExamContent(data),
    onSuccess: (_, variables) => {
      toast.success("Unpublished - page is now hidden from visitors.");
      invalidateExamContent(queryClient, variables.examId);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to unpublish.");
    },
  });
};

export const useExamContentReadyForReviewMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ReadyForReviewInput) => postAdminExamContentReadyForReview(data),
    onSuccess: (_, variables) => {
      toast.success(variables.readyForReview ? "Marked ready for review." : "Ready for review mark removed.");
      // Returned so the mutation stays pending until the editor has refetched.
      return invalidateExamContent(queryClient, variables.examId);
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to update the review status.");
    },
  });
};