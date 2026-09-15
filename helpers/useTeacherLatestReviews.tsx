import { useQuery } from "@tanstack/react-query";
import { getTeacherLatestReviews } from "../endpoints/teacher/reviews/latest_GET.schema";

export const TEACHER_LATEST_REVIEWS_QUERY_KEY = ["teacher", "reviews", "latest"];

export const useTeacherLatestReviews = () => {
  return useQuery({
    queryKey: TEACHER_LATEST_REVIEWS_QUERY_KEY,
    queryFn: () => getTeacherLatestReviews(),
    staleTime: 15 * 60 * 1000,
  });
};