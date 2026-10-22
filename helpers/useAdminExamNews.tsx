import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAdminExamNewsList, InputType as ListInput } from "../endpoints/admin/exam-news/list_GET.schema";
import { getAdminExamNewsPost } from "../endpoints/admin/exam-news/get_GET.schema";
import { postAdminExamNewsSave, InputType as SaveInput } from "../endpoints/admin/exam-news/save_POST.schema";
import { postAdminExamNewsStatus, InputType as StatusInput } from "../endpoints/admin/exam-news/status_POST.schema";
import { postAdminExamNewsDelete } from "../endpoints/admin/exam-news/delete_POST.schema";
import { getExamNewsExams } from "../endpoints/exam-news/exams_GET.schema";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_EXAM_NEWS_QUERY_KEY = ["admin", "exam-news"] as const;

const STATUS_TOASTS: Record<StatusInput["action"], string> = {
  publish: "Published",
  unpublish: "Moved back to draft",
  archive: "Archived",
  restore: "Restored as a draft",
};

export const useAdminExamNewsList = (input: ListInput) =>
  useQuery({
    queryKey: [...ADMIN_EXAM_NEWS_QUERY_KEY, "list", input],
    queryFn: () => getAdminExamNewsList(input),
    placeholderData: (previous) => previous,
  });

/** The editor and preview always refetch on mount so they never open on a cached copy. */
export const useAdminExamNewsPost = (id: number | null) =>
  useQuery({
    queryKey: [...ADMIN_EXAM_NEWS_QUERY_KEY, "detail", id],
    queryFn: () => getAdminExamNewsPost({ id: id! }),
    enabled: id !== null,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

/** Looks up one exam by id, for a filter restored from the URL. */
export const useExamNewsExamSearch = (input: { id: number | undefined }, enabled = true) =>
  useQuery({
    queryKey: [...ADMIN_EXAM_NEWS_QUERY_KEY, "exams", input.id ?? null],
    queryFn: () => getExamNewsExams(input),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

/** Errors are left to the editor, which maps validation issues onto fields. */
export const useSaveExamNewsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveInput) => postAdminExamNewsSave(data),
    onSuccess: ({ post }) => {
      queryClient.setQueryData([...ADMIN_EXAM_NEWS_QUERY_KEY, "detail", post.id], { post });
      queryClient.invalidateQueries({ queryKey: [...ADMIN_EXAM_NEWS_QUERY_KEY, "list"] });
    },
  });
};

export const useExamNewsStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StatusInput) => postAdminExamNewsStatus(data),
    onSuccess: (_result, variables) => {
      toast.success(STATUS_TOASTS[variables.action]);
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_NEWS_QUERY_KEY });
    },
  });
};

export const useDeleteExamNewsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAdminExamNewsDelete({ id }),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ADMIN_EXAM_NEWS_QUERY_KEY });
    },
    onError: (error) => toast.error(parseErrorMessage(error) || "Could not delete this story"),
  });
};