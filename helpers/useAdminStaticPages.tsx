import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminStaticPagesList } from "../endpoints/admin/static-pages/list_GET.schema";
import {
  postAdminUpdateStaticPage,
  InputType as UpdateStaticPageInput,
} from "../endpoints/admin/static-pages/update_POST.schema";

export const ADMIN_STATIC_PAGES_QUERY_KEY = ["admin", "staticPages"] as const;

/**
 * A React Query hook to fetch the list of all static pages for the admin panel.
 *
 * @returns The result of the `useQuery` hook.
 */
export const useAdminStaticPagesQuery = () => {
  return useQuery({
    queryKey: ADMIN_STATIC_PAGES_QUERY_KEY,
    queryFn: getAdminStaticPagesList,
  });
};

/**
 * A React Query mutation hook for updating a static page's content.
 *
 * On success, it displays a success toast and invalidates the static pages list
 * to ensure the admin UI reflects the changes.
 *
 * @returns The result of the `useMutation` hook.
 */
export const useUpdateStaticPageMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateStaticPageInput) => postAdminUpdateStaticPage(data),
    onSuccess: (data) => {
      toast.success(`Page "${data.updatedPage.title}" updated successfully.`);
      queryClient.invalidateQueries({ queryKey: ADMIN_STATIC_PAGES_QUERY_KEY });
    },
    onError: (error) => {
      console.error("Failed to update static page:", error);
      toast.error(
        parseErrorMessage(error) ||  "An unknown error occurred."
      );
    },
  });
};