import { useQuery } from "@tanstack/react-query";
import { getGlossaryList } from "../endpoints/glossary/list_GET.schema";
import { getGlossaryDetails } from "../endpoints/glossary/details_GET.schema";

/* Query keys are shared with the SSR prefetches in helpers/glossaryPrefetch. */
export const glossaryPublicKeys = {
  all: ["glossary"] as const,
  list: () => ["glossary", "list"] as const,
  details: (slug: string) => ["glossary", "details", slug] as const,
};

export const useGlossaryTerms = () =>
  useQuery({
    queryKey: glossaryPublicKeys.list(),
    queryFn: () => getGlossaryList(),
    staleTime: 5 * 60 * 1000,
  });

export const useGlossaryDetails = (slug: string) =>
  useQuery({
    queryKey: glossaryPublicKeys.details(slug),
    queryFn: () => getGlossaryDetails({ slug }),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    // A missing term will not appear on retry; only network or server errors are worth repeating.
    retry: (count, error) => !/not found/i.test(String(error)) && count < 2,
  });