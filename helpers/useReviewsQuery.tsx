import { useQuery } from "@tanstack/react-query";
import { getReviewsList } from "../endpoints/reviews/list_GET.schema";

export const useReviewsQuery = (mockTestId: number) => {
  return useQuery({
    queryKey: ["reviews", mockTestId],
    queryFn: () => getReviewsList({ mockTestId }),
    enabled: !!mockTestId && mockTestId > 0,
    staleTime: 5 * 60 * 1000,
  });
};