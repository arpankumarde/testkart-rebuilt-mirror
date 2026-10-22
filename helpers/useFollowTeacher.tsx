import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postTeachersFollow } from "../endpoints/teachers/follow_POST.schema";

/**
 * Sets the current student's follow status for a teacher. Invalidates the
 * cached public profile (keyed by slug) and search results so the follower
 * count and button state settle to whatever the server returns, rather than
 * trusting an optimistic guess forever if two tabs are open.
 */
export const useFollowTeacherMutation = (teacherSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { teacherId: number; follow: boolean }) => postTeachersFollow(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacherProfile", teacherSlug] });
      queryClient.invalidateQueries({ queryKey: ["homepage-search"] });
    },
  });
};
