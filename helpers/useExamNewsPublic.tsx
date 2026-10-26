import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getExamNewsList, InputType as ListInput } from "../endpoints/exam-news/list_GET.schema";
import { getExamNewsSidebar } from "../endpoints/exam-news/sidebar_GET.schema";
import { getExamNewsDetails } from "../endpoints/exam-news/details_GET.schema";
import { getExamNewsExams } from "../endpoints/exam-news/exams_GET.schema";
import { getExamNewsResources } from "../endpoints/exam-news/resources_GET.schema";

/* Query keys are shared with the SSR prefetches in helpers/examNewsPrefetch. */
export const examNewsPublicKeys = {
  list: (input: ListInput) => ["exam-news", "list", input] as const,
  sidebar: () => ["exam-news", "sidebar"] as const,
  details: (slug: string) => ["exam-news", "details", slug] as const,
  resources: (exam: string | undefined, all: boolean) => ["exam-news", "resources", exam ?? "", all] as const,
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

/** Verified teachers' resources for an exam (the Hot exams when there is none); `all` lists every teacher. */
export const useExamNewsResources = (exam: string | undefined, all = false, enabled = true) =>
  useQuery({
    queryKey: examNewsPublicKeys.resources(exam, all),
    queryFn: () => getExamNewsResources({ exam, all: all || undefined }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

/** The story at /exam-news/{slug}; null when no story has that slug, so the path may be an exam's listing. */
export const useExamNewsDetails = (slug: string) =>
  useQuery({
    queryKey: examNewsPublicKeys.details(slug),
    queryFn: async () => {
      try {
        return await getExamNewsDetails({ slug });
      } catch (error) {
        if (/not found/i.test(String(error))) return null;
        throw error;
      }
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    retry: (count) => count < 2,
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