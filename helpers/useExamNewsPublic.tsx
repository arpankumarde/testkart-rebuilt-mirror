import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getExamNewsList, InputType as ListInput } from "../endpoints/exam-news/list_GET.schema";
import { getExamNewsSidebar } from "../endpoints/exam-news/sidebar_GET.schema";
import { getExamNewsDetails } from "../endpoints/exam-news/details_GET.schema";
import { getExamNewsExams } from "../endpoints/exam-news/exams_GET.schema";

/* Query keys are shared with the SSR prefetches in helpers/examNewsPrefetch. */
export const examNewsPublicKeys = {
  list: (input: ListInput) => ["exam-news", "list", input] as const,
  sidebar: () => ["exam-news", "sidebar"] as const,
  details: (slug: string) => ["exam-news", "details", slug] as const,
};

export const useExamNewsList = (input: ListInput, enabled = true) =>
  useQuery({
    queryKey: examNewsPublicKeys.list(input),
    queryFn: () => getExamNewsList(input),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 5 * 60 * 1000,
  });

export const useExamNewsSidebar = () =>
  useQuery({
    queryKey: examNewsPublicKeys.sidebar(),
    queryFn: () => getExamNewsSidebar(),
    staleTime: 5 * 60 * 1000,
  });

export const useExamNewsDetails = (slug: string) =>
  useQuery({
    queryKey: examNewsPublicKeys.details(slug),
    queryFn: () => getExamNewsDetails({ slug }),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    // A missing story will not appear on retry; only network or server errors are worth repeating.
    retry: (count, error) => !/not found/i.test(String(error)) && count < 2,
  });

/** The exam picker's list: the search results, or the whole catalogue, loaded a page at a time. */
export const useExamNewsExamPages = (search: string | undefined, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: ["exam-news", "exams", search ?? ""],
    queryFn: ({ pageParam }) => getExamNewsExams({ search, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => (lastPage.hasMore ? pages.reduce((total, page) => total + page.exams.length, 0) : undefined),
    enabled,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });