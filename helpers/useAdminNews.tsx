import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminNewsList } from "../endpoints/admin/news/list_GET.schema";
import {
  postAdminNewsUpsert,
  InputType as UpsertInputType,
} from "../endpoints/admin/news/upsert_POST.schema";
import {
  postAdminNewsDelete,
  InputType as DeleteInputType,
} from "../endpoints/admin/news/delete_POST.schema";
import { NEWS_LIST_QUERY_KEY } from "./useNewsQuery";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const ADMIN_NEWS_QUERY_KEY = ["admin", "news"] as const;

/** The editor passes refetchOnMount "always" so it never opens on a cached copy. */
export const useAdminNewsQuery = (options?: { refetchOnMount?: boolean | "always" }) => {
  return useQuery({
    queryKey: ADMIN_NEWS_QUERY_KEY,
    queryFn: () => getAdminNewsList(),
    ...(options ?? {}),
  });
};

export const useUpsertNewsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpsertInputType) => postAdminNewsUpsert(data),
    onSuccess: () => {
      toast.success("News coverage saved");
      queryClient.invalidateQueries({ queryKey: ADMIN_NEWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["news", "details"] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to save news coverage");
    },
  });
};

export const useDeleteNewsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DeleteInputType) => postAdminNewsDelete(data),
    onSuccess: () => {
      toast.success("News coverage deleted");
      queryClient.invalidateQueries({ queryKey: ADMIN_NEWS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: NEWS_LIST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["news", "details"] });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error) || "Failed to delete news coverage");
    },
  });
};
