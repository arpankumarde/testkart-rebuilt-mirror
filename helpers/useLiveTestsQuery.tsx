import { useQuery } from "@tanstack/react-query";
import { getLiveTestsList, InputType } from "../endpoints/live-tests/list_GET.schema";

export const LIVE_TESTS_QUERY_KEY = ["liveTests"] as const;

export const useLiveTestsQuery = (filters?: Partial<InputType>) => {
  return useQuery({
    queryKey: [...LIVE_TESTS_QUERY_KEY, filters],
    queryFn: () => getLiveTestsList(filters),
    staleTime: 5 * 60 * 1000,
  });
};