import { useQuery } from "@tanstack/react-query";
import { getAdminOrders } from "../endpoints/admin/orders_GET.schema";

export const ADMIN_ORDERS_QUERY_KEY = ["admin", "orders"] as const;

/**
 * A React Query hook to fetch all student orders for the admin dashboard.
 *
 * This hook calls the `/api/admin/orders` endpoint and provides data, loading, and error states.
 * It is configured to refetch data when the component mounts or when the browser window regains focus.
 *
 * @returns The result of the `useQuery` hook, containing the list of orders.
 */
export const useAdminOrdersQuery = () => {
  return useQuery({
    queryKey: ADMIN_ORDERS_QUERY_KEY,
    queryFn: () => getAdminOrders(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};