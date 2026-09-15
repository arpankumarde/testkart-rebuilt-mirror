import { useQuery } from "@tanstack/react-query";
import { getHomepageSearch } from "../endpoints/homepage/search_GET.schema";

export const useHomepageSearch = (query: string, limit?: number) => {
  return useQuery({
    queryKey: ["homepage-search", query, limit],
    queryFn: () => getHomepageSearch({ q: query, limit }),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000, // 30 seconds stale time for quick repetitive searches
  });
};