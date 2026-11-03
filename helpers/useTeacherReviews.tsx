import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getTeacherReviews, type InputType } from "../endpoints/teacher/reviews/list_GET.schema";
import { postTeacherReviewReply } from "../endpoints/teacher/reviews/reply_POST.schema";

export const TEACHER_REVIEWS_QUERY_KEY = ["teacher", "reviews", "list"] as const;

/** One page of the teacher's reviews across test series, courses and notes, plus stats. */
export const useTeacherReviews = (query: InputType) =>
  useQuery({
    queryKey: [...TEACHER_REVIEWS_QUERY_KEY, query],
    queryFn: () => getTeacherReviews(query),
    placeholderData: keepPreviousData,
    // Reviews arrive any time; the app default never refetches on mount.
    refetchOnMount: "always",
  });

export const useReplyToReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postTeacherReviewReply,
    onSuccess: (data) => {
      toast.success(data.teacherReply ? "Reply posted. Students see it under the review." : "Reply removed");
      queryClient.invalidateQueries({ queryKey: TEACHER_REVIEWS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Your reply was not saved. Try again.");
    },
  });
};