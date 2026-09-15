import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminLiveTestsList } from "../endpoints/admin/live-tests/list_GET.schema";
import { postDeactivateLiveTest } from "../endpoints/admin/live-tests/deactivate_POST.schema";

export const ADMIN_LIVE_TESTS_QUERY_KEY = ["admin", "live-tests"] as const;

/**
 * A React Query hook to fetch the list of all live tests for the admin panel.
 *
 * This hook calls the `/api/admin/live-tests/list` endpoint and provides data, loading, and error states.
 *
 * @returns The result of the `useQuery` hook, containing the list of all live tests.
 */
export const useAdminLiveTestsQuery = () => {
  return useQuery({
    queryKey: ADMIN_LIVE_TESTS_QUERY_KEY,
    queryFn: () => getAdminLiveTestsList(),
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * A React Query mutation hook for deactivating a live test.
 *
 * This hook calls the `/api/admin/live-tests/deactivate` endpoint. On success, it
 * automatically invalidates the admin live tests list query to refetch the updated data.
 *
 * @returns The result of the `useMutation` hook.
 */
export const useDeactivateLiveTestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postDeactivateLiveTest,
    onSuccess: () => {
      // Invalidate and refetch the live tests list to reflect the change in status
      queryClient.invalidateQueries({ queryKey: ADMIN_LIVE_TESTS_QUERY_KEY });
    },
  });
};