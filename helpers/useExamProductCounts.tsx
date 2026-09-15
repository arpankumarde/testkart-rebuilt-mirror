import { useQuery } from "@tanstack/react-query";
import { getExamProductCounts } from "../endpoints/exam-products/counts_GET.schema";

export const useExamProductCountsQuery = (examSlug: string | undefined) => {
  return useQuery({
    queryKey: ["exam-products", "counts", examSlug],
    queryFn: () => getExamProductCounts({ examSlug: examSlug as string }),
    enabled: !!examSlug,
    staleTime: 5 * 60 * 1000,
  });
};
