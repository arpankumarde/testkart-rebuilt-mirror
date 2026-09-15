import { useQuery } from "@tanstack/react-query";
import { getStudentTestAttemptsLatestResults } from "../endpoints/student/test-attempts/latest-results_GET.schema";

export const TEST_RESULTS_QUERY_KEY = "studentTestLatestResults";

export const useTestResultsQuery = (testItemId: number | undefined) => {
  return useQuery({
    queryKey: [TEST_RESULTS_QUERY_KEY, testItemId],
    queryFn: () => {
      if (!testItemId) {
        throw new Error("testItemId is required to fetch results.");
      }
      return getStudentTestAttemptsLatestResults({ testItemId });
    },
    enabled: !!testItemId,
    retry: (failureCount, error) => {
      // Don't retry on 404 (no attempts) or 403 (not enrolled)
      if (error.message.includes("No completed attempts") || error.message.includes("not enrolled")) {
        return false;
      }
      return failureCount < 3;
    },
    staleTime: 5 * 60 * 1000,
  });
};