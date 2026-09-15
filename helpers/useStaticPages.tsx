import { useQuery } from "@tanstack/react-query";
import { getStaticPage } from "../endpoints/static-page_GET.schema";

export const STATIC_PAGE_QUERY_KEY_PREFIX = "staticPage" as const;

/**
 * A React Query hook to fetch a single public static page by its slug.
 *
 * @param slug The unique slug of the page to fetch.
 * @returns The result of the `useQuery` hook.
 */
export const useStaticPageQuery = (slug: string) => {
  return useQuery({
    queryKey: [STATIC_PAGE_QUERY_KEY_PREFIX, slug],
    queryFn: () => getStaticPage({ slug }),
    enabled: !!slug, // The query will not run until a slug is provided.
  });
};