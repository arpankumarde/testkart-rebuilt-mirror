import { useQuery } from "@tanstack/react-query";
import { getLiveTestsDetails } from "../endpoints/live-tests/details_GET.schema";
import { useAuth } from "./useAuth";
import { isNotFoundError } from "./isNotFoundError";

export const LIVE_TEST_DETAILS_QUERY_KEY_PREFIX = "liveTest";

export const useLiveTestDetailsQuery = (liveTestId: number | undefined | null) => {
  const { authState } = useAuth();
  const userId = authState.type === "authenticated" ? authState.user.id : "guest";

  return useQuery({
    queryKey: [LIVE_TEST_DETAILS_QUERY_KEY_PREFIX, liveTestId, userId],
    queryFn: () => getLiveTestsDetails({ id: liveTestId! }),
    enabled: !!liveTestId, // The query will not run until the liveTestId is available
    refetchOnMount: "always", // Always refetch to ensure fresh data
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
  });
};