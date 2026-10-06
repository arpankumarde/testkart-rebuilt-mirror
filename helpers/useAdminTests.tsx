import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { getAdminTestSeriesPage, InputType as TestSeriesPageInput } from "../endpoints/admin/tests/page_GET.schema";
import { postDeactivateTest } from "../endpoints/admin/tests/deactivate_POST.schema";

export const ADMIN_TESTS_QUERY_KEY = ["admin", "tests"] as const;

/* One page of the admin test series list; the previous page stays on screen while the next loads. */
export const useAdminTestSeriesPageQuery = (input: TestSeriesPageInput) => {
  return useQuery({
    queryKey: [...ADMIN_TESTS_QUERY_KEY, "page", input],
    queryFn: () => getAdminTestSeriesPage(input),
    placeholderData: keepPreviousData,
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