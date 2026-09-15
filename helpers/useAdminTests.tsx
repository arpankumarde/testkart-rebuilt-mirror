import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminTestsList } from "../endpoints/admin/tests/list_GET.schema";
import { postDeactivateTest } from "../endpoints/admin/tests/deactivate_POST.schema";

export const ADMIN_TESTS_QUERY_KEY = ["admin", "tests"] as const;

/**
 * A React Query hook to fetch the list of all mock tests for the admin panel.
 *
 * This hook calls the `/api/admin/tests/list` endpoint and provides data, loading, and error states.
 *
 * @returns The result of the `useQuery` hook, containing the list of all tests.
 */
export const useAdminTestsQuery = () => {
  return useQuery({
    queryKey: ADMIN_TESTS_QUERY_KEY,
    queryFn: getAdminTestsList,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * A React Query mutation hook for deactivating a mock test series.
 *
 * This hook calls the `/api/admin/tests/deactivate` endpoint. On success, it
 * automatically invalidates the admin tests list query to refetch the updated data.
 *
 * @returns The result of the `useMutation` hook.
 */
export const useDeactivateTestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postDeactivateTest,
    onSuccess: () => {
      // Invalidate and refetch the tests list to reflect the change in status
      queryClient.invalidateQueries({ queryKey: ADMIN_TESTS_QUERY_KEY });
    },
  });
};