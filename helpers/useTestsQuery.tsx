import { useQuery } from "@tanstack/react-query";
import { getTestsList, InputType } from "../endpoints/tests/list_GET.schema";

export const TESTS_QUERY_KEY = ["tests", "list"] as const;

export const DEFAULT_PAGE_SIZE = 20;

/** Other series for the same exam as the given one, best value first (the series page's related block). */
export const useRelatedTestsQuery = (seriesId: number | null | undefined, limit = 4) => {
  return useQuery({
    queryKey: [...TESTS_QUERY_KEY, "related", seriesId, limit],
    queryFn: () => getTestsList({ relatedTo: String(seriesId), sortBy: "recommended", limit: String(limit) }),
    enabled: !!seriesId,
    staleTime: 15 * 60 * 1000,
  });
};

export const useTestsQuery = (filters?: InputType) => {
  return useQuery({
    queryKey: [...TESTS_QUERY_KEY, filters],
    queryFn: () => getTestsList(filters),
    placeholderData: (previousData) => previousData,
    staleTime: 10 * 60 * 1000,
  });
};