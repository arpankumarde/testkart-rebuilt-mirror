import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getBundlesList,
  InputType as ListInputType,
} from "../endpoints/bundles/list_GET.schema";
import {
  getBundlesDetails,
  InputType as DetailsInputType,
} from "../endpoints/bundles/details_GET.schema";

export const PUBLIC_BUNDLES_QUERY_KEY = ["public", "bundles"];
export const PUBLIC_BUNDLE_DETAILS_QUERY_KEY = (slug: string) => [
  ...PUBLIC_BUNDLES_QUERY_KEY,
  "details",
  slug,
];

/**
 * A React Query hook to fetch the public list of published course bundles.
 * Supports pagination and filtering.
 *
 * @param filters - Optional filters for the query (page, limit, sort, etc.).
 * @returns The React Query result object.
 */
export const useBundlesQuery = (filters?: ListInputType) => {
  return useQuery({
    queryKey: [...PUBLIC_BUNDLES_QUERY_KEY, filters],
    queryFn: () => getBundlesList(filters),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60 * 1000,
  });
};

/**
 * A React Query hook to fetch the public details of a single course bundle by its slug.
 *
 * @param slug - The slug of the bundle to fetch. The query is disabled if the slug is not provided.
 * @returns The React Query result object.
 */
export const useBundleDetailsQuery = (slug: string | null) => {
  return useQuery({
    queryKey: PUBLIC_BUNDLE_DETAILS_QUERY_KEY(slug!),
    queryFn: () => getBundlesDetails({ slug: slug! }),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
  });
};