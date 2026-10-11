import { useQuery } from "@tanstack/react-query";
import { getExternalReviews } from "../endpoints/reviews/external_GET.schema";

export const EXTERNAL_REVIEWS_QUERY_KEY = ["external", "reviews"];

/** Reviews change rarely; five minutes keeps /about from refetching on every visit. */
export const useExternalReviewsQuery = () => {
  return useQuery({
    queryKey: EXTERNAL_REVIEWS_QUERY_KEY,
    queryFn: () => getExternalReviews(),
    staleTime: 5 * 60_000,
  });
};
