import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getCurrentAffairsHub, InputType as HubInput } from "../endpoints/current-affairs/hub_GET.schema";
import { getCurrentAffairsList, InputType as ListInput, type PublicListType } from "../endpoints/current-affairs/list_GET.schema";
import { getCurrentAffairsDetails } from "../endpoints/current-affairs/details_GET.schema";

export type FeedInput = { type: PublicListType; lang?: "en" | "hi" };

/* Query keys are shared with the SSR prefetches in pages/current-affairs*.prefetch.ts. */
export const currentAffairsPublicKeys = {
  hub: (input: HubInput) => ["current-affairs", "hub", input.lang ?? "all"] as const,
  list: (input: ListInput) => ["current-affairs", "list", input] as const,
  feed: (input: FeedInput) => ["current-affairs", "feed", input.type, input.lang ?? "all"] as const,
  details: (slug: string) => ["current-affairs", "details", slug] as const,
};

export const useCurrentAffairsHub = (input: HubInput) =>
  useQuery({
    queryKey: currentAffairsPublicKeys.hub(input),
    queryFn: () => getCurrentAffairsHub(input),
    staleTime: 5 * 60 * 1000,
  });

export const useCurrentAffairsList = (input: ListInput, enabled: boolean) =>
  useQuery({
    queryKey: currentAffairsPublicKeys.list(input),
    queryFn: () => getCurrentAffairsList(input),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 5 * 60 * 1000,
  });

/** One digest type, newest period first, grown a page at a time by "Load more". */
export const useCurrentAffairsFeed = (input: FeedInput) =>
  useInfiniteQuery({
    queryKey: currentAffairsPublicKeys.feed(input),
    queryFn: ({ pageParam }) => getCurrentAffairsList({ type: input.type, lang: input.lang, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length < last.totalPages ? pages.length + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });

export const useCurrentAffairsDetails = (slug: string) =>
  useQuery({
    queryKey: currentAffairsPublicKeys.details(slug),
    queryFn: () => getCurrentAffairsDetails({ slug }),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    // A missing digest will not appear on retry; only network or server errors are worth repeating.
    retry: (count, error) => !/not found/i.test(String(error)) && count < 2,
  });