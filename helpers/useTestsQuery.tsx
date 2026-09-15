import { useQuery } from "@tanstack/react-query";
import { getTestsList, InputType } from "../endpoints/tests/list_GET.schema";

export const TESTS_QUERY_KEY = ["tests", "list"] as const;

export const DEFAULT_PAGE_SIZE = 20;

export const useTestsQuery = (filters?: InputType) => {
  return useQuery({
    queryKey: [...TESTS_QUERY_KEY, filters],
    queryFn: () => getTestsList(filters),
    placeholderData: (previousData) => previousData,
    staleTime: 10 * 60 * 1000,
  });
};