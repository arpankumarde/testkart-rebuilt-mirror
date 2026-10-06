import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { getAdminNotesPage, InputType as NotesPageInput } from "../endpoints/admin/products/page_GET.schema";
import { postDeactivateProduct } from "../endpoints/admin/products/deactivate_POST.schema";

export const ADMIN_PRODUCTS_QUERY_KEY = ["admin", "products"] as const;

/* One page of the admin study notes list; the previous page stays on screen while the next loads. */
export const useAdminNotesPageQuery = (input: NotesPageInput) => {
  return useQuery({
    queryKey: [...ADMIN_PRODUCTS_QUERY_KEY, "page", input],
    queryFn: () => getAdminNotesPage(input),
    placeholderData: keepPreviousData,
  });
};

/* Archives a study note, then drops every cached notes page so the lists refetch. */
export const useDeactivateProductMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postDeactivateProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_QUERY_KEY });
    },
  });
};
