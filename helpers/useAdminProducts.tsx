import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminProductsList } from "../endpoints/admin/products/list_GET.schema";
import { postDeactivateProduct } from "../endpoints/admin/products/deactivate_POST.schema";

export const ADMIN_PRODUCTS_QUERY_KEY = ["admin", "products"] as const;

/**
 * A React Query hook to fetch the list of all digital products for the admin panel.
 *
 * This hook calls the `/api/admin/products/list` endpoint and provides data, loading, and error states.
 *
 * @returns The result of the `useQuery` hook, containing the list of all digital products.
 */
export const useAdminProductsQuery = () => {
  return useQuery({
    queryKey: ADMIN_PRODUCTS_QUERY_KEY,
    queryFn: () => getAdminProductsList(),
  });
};

/**
 * A React Query mutation hook for deactivating a digital product.
 *
 * This hook calls the `/api/admin/products/deactivate` endpoint. On success, it
 * automatically invalidates the admin products list query to refetch the updated data.
 *
 * @returns The result of the `useMutation` hook.
 */
export const useDeactivateProductMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postDeactivateProduct,
    onSuccess: () => {
      // Invalidate and refetch the products list to reflect the change in status
      queryClient.invalidateQueries({ queryKey: ADMIN_PRODUCTS_QUERY_KEY });
    },
  });
};