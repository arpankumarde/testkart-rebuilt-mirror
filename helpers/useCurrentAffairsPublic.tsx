import { useQuery } from "@tanstack/react-query";
import { getCurrentAffairsHub, InputType as HubInput } from "../endpoints/current-affairs/hub_GET.schema";
import { getCurrentAffairsList, InputType as ListInput } from "../endpoints/current-affairs/list_GET.schema";
import { getCurrentAffairsDetails, InputType as DetailsInput } from "../endpoints/current-affairs/details_GET.schema";
import { getCurrentAffairsStories, InputType as StoriesInput } from "../endpoints/current-affairs/stories_GET.schema";

/* Query keys are shared with the SSR prefetches in pages/current-affairs*.prefetch.ts. */
export const currentAffairsPublicKeys = {
  hub: (input: HubInput) => ["current-affairs", "hub", input.lang ?? "all"] as const,
  list: (input: ListInput) => ["current-affairs", "list", input] as const,
  stories: (input: StoriesInput) => ["current-affairs", "stories", input] as const,
  details: (input: DetailsInput) =>
    ["current-affairs", "details", input.type && input.period ? `${input.type}/${input.period}` : `slug:${input.slug ?? ""}`] as const,
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

/** Stories from published daily digests, a page at a time. */
export const useCurrentAffairsStories = (input: StoriesInput, enabled: boolean) =>
  useQuery({
    queryKey: currentAffairsPublicKeys.stories(input),
    queryFn: () => getCurrentAffairsStories(input),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 5 * 60 * 1000,
  });

export const useCurrentAffairsDetails = (input: DetailsInput) =>
  useQuery({
    queryKey: currentAffairsPublicKeys.details(input),
    queryFn: () => getCurrentAffairsDetails(input),
    enabled: !!input.slug || (!!input.type && !!input.period),
    staleTime: 5 * 60 * 1000,
    // A missing digest will not appear on retry; only network or server errors are worth repeating.
    retry: (count, error) => !/not found/i.test(String(error)) && count < 2,
  });