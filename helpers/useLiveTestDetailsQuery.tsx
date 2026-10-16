import { useQuery } from "@tanstack/react-query";
import { getLiveTestsDetails } from "../endpoints/live-tests/details_GET.schema";
import { useAuth } from "./useAuth";
import { isNotFoundError } from "./isNotFoundError";
import { LIVE_TEST_DETAILS_QUERY_KEY_PREFIX, liveTestDetailsBySlugQueryKey } from "./liveTestQueryKeys";

export { LIVE_TEST_DETAILS_QUERY_KEY_PREFIX };

const useViewerKey = () => {
  const { authState } = useAuth();
  return authState.type === "authenticated" ? authState.user.id : "guest";
};

export const useLiveTestDetailsQuery = (liveTestId: number | undefined | null) => {
  const userId = useViewerKey();

  return useQuery({
    queryKey: [LIVE_TEST_DETAILS_QUERY_KEY_PREFIX, liveTestId, userId],
    queryFn: () => getLiveTestsDetails({ id: liveTestId! }),
    enabled: !!liveTestId, // The query will not run until the liveTestId is available
    refetchOnMount: "always", // Always refetch to ensure fresh data
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
  });
};

export const useLiveTestDetailsBySlugQuery = (slug: string | undefined) => {
  const userId = useViewerKey();

  return useQuery({
    queryKey: liveTestDetailsBySlugQueryKey(slug, userId),
    queryFn: () => getLiveTestsDetails({ slug: slug! }),
    enabled: !!slug,
    refetchOnMount: "always",
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
  });
};
