import { useQuery } from "@tanstack/react-query";
import { getTestsDetails } from "../endpoints/tests/details_GET.schema";

export const useTestDetailsQuery = (slug: string | undefined) => {
  return useQuery({
    queryKey: ["tests", "details", slug],
    queryFn: () => getTestsDetails({ slug: slug! }),
    enabled: !!slug, // The query will not run until the slug is available
    staleTime: 10 * 60 * 1000,
  });
};