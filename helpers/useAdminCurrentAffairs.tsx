import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminCurrentAffairsList,
  InputType as ListInput,
} from "../endpoints/admin/current-affairs/list_GET.schema";
import { getAdminCurrentAffairsPost } from "../endpoints/admin/current-affairs/get_GET.schema";
import { getAdminCurrentAffairsTags } from "../endpoints/admin/current-affairs/tags_GET.schema";
import {
  postAdminCurrentAffairsSave,
  InputType as SaveInput,
} from "../endpoints/admin/current-affairs/save_POST.schema";
import {
  postAdminCurrentAffairsStatus,
  InputType as StatusInput,
} from "../endpoints/admin/current-affairs/status_POST.schema";
import { postAdminCurrentAffairsDuplicate } from "../endpoints/admin/current-affairs/duplicate_POST.schema";
import { postAdminCurrentAffairsDelete } from "../endpoints/admin/current-affairs/delete_POST.schema";
import {
  postAdminCurrentAffairsGenerateQuiz,
  InputType as GenerateQuizInput,
} from "../endpoints/admin/current-affairs/generate-quiz_POST.schema";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_CURRENT_AFFAIRS_QUERY_KEY = ["admin", "current-affairs"] as const;

const STATUS_TOASTS: Record<StatusInput["action"], string> = {
  publish: "Published",
  unpublish: "Moved back to draft",
  archive: "Archived",
  restore: "Restored as a draft",
};

export const useAdminCurrentAffairsList = (input: ListInput) =>
  useQuery({
    queryKey: [...ADMIN_CURRENT_AFFAIRS_QUERY_KEY, "list", input],
    queryFn: () => getAdminCurrentAffairsList(input),
    placeholderData: (previous) => previous,
  });

/** The editor and preview always refetch on mount so they never open on a cached copy. */
export const useAdminCurrentAffairsPost = (id: number | null) =>
  useQuery({
    queryKey: [...ADMIN_CURRENT_AFFAIRS_QUERY_KEY, "detail", id],
    queryFn: () => getAdminCurrentAffairsPost({ id: id! }),
    enabled: id !== null,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

export const useAdminCurrentAffairsTags = () =>
  useQuery({
    queryKey: [...ADMIN_CURRENT_AFFAIRS_QUERY_KEY, "tags"],
    queryFn: () => getAdminCurrentAffairsTags(),
    staleTime: 60_000,
  });

/** Errors are left to the editor, which maps validation issues onto fields. */
export const useSaveCurrentAffairsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveInput) => postAdminCurrentAffairsSave(data),
    onSuccess: ({ post }) => {
      queryClient.setQueryData([...ADMIN_CURRENT_AFFAIRS_QUERY_KEY, "detail", post.id], { post });
      queryClient.invalidateQueries({ queryKey: [...ADMIN_CURRENT_AFFAIRS_QUERY_KEY, "list"] });
      queryClient.invalidateQueries({ queryKey: [...ADMIN_CURRENT_AFFAIRS_QUERY_KEY, "tags"] });
    },
  });
};

export const useCurrentAffairsStatusMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: StatusInput) => postAdminCurrentAffairsStatus(data),
    onSuccess: (_result, variables) => {
      toast.success(STATUS_TOASTS[variables.action]);
      queryClient.invalidateQueries({ queryKey: ADMIN_CURRENT_AFFAIRS_QUERY_KEY });
    },
  });
};

export const useDuplicateCurrentAffairsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAdminCurrentAffairsDuplicate({ id }),
    onSuccess: () => {
      toast.success("Copied as a new draft");
      queryClient.invalidateQueries({ queryKey: [...ADMIN_CURRENT_AFFAIRS_QUERY_KEY, "list"] });
    },
    onError: (error) => toast.error(parseErrorMessage(error) || "Could not duplicate this post"),
  });
};

export const useDeleteCurrentAffairsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => postAdminCurrentAffairsDelete({ id }),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries({ queryKey: ADMIN_CURRENT_AFFAIRS_QUERY_KEY });
    },
    onError: (error) => toast.error(parseErrorMessage(error) || "Could not delete this post"),
  });
};

/** Errors are shown by the quiz editor next to the form that asked. */
export const useGenerateCurrentAffairsQuizMutation = () =>
  useMutation({
    mutationFn: (data: GenerateQuizInput) => postAdminCurrentAffairsGenerateQuiz(data),
  });