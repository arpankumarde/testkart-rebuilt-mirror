import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getHomepageSearch } from "../endpoints/homepage/search_GET.schema";
import { getHomepageSearchTeachers } from "../endpoints/homepage/search/teachers_GET.schema";

export const useHomepageSearch = (query: string, limit?: number) => {
  return useQuery({
    queryKey: ["homepage-search", query, limit],
    queryFn: () => getHomepageSearch({ q: query, limit }),
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000, // 30 seconds stale time for quick repetitive searches
  });
};

// The first page of teachers arrives with the homepage search, so this only
// runs from "Load more" and starts after the teachers already shown.
export const useMoreTeacherResults = (query: string, loaded: number, limit: number) =>
  useInfiniteQuery({
    queryKey: ["homepage-search-teachers", query, limit],
    queryFn: ({ pageParam }) => getHomepageSearchTeachers({ q: query, limit, offset: pageParam }),
    initialPageParam: loaded,
    getNextPageParam: (lastPage, _pages, lastPageParam) => lastPageParam + lastPage.teachers.length,
    enabled: false,
  });