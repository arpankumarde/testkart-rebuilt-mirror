import { useMutation, useQueryClient, type Query } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  postTeacherContentReviewsWithdraw,
  type InputType,
} from "../endpoints/teacher/content-reviews/withdraw_POST.schema";
import { parseErrorMessage } from "./parseErrorMessage";

// Every teacher console query key starts with "teacher" ("teacher", "teacherLiveTests").
const isTeacherQuery = (query: Query) =>
  typeof query.queryKey[0] === "string" && query.queryKey[0].startsWith("teacher");

/*
 * Teacher lists never refetch on mount, so off-screen ones are dropped and load
 * fresh when next opened; the page on screen refetches in place.
 */
const refreshTeacherQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.removeQueries({ predicate: isTeacherQuery, type: "inactive" });
  queryClient.invalidateQueries({ predicate: isTeacherQuery });
};

export const useWithdrawContentReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: InputType) => postTeacherContentReviewsWithdraw(input),
    onSuccess: (data) => {
      toast.success("Taken back from review", { description: data.message });
      refreshTeacherQueries(queryClient);
    },
    onError: (error: unknown) => {
      toast.error("Could not take it back", { description: parseErrorMessage(error) });
      refreshTeacherQueries(queryClient);
    },
  });
};