import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postTeachersFollow } from "../endpoints/teachers/follow_POST.schema";

/**
 * Toggles the current student's follow status for a teacher. Invalidates the
 * cached public profile (keyed by slug) so the follower count and button
 * state settle to whatever the server returns, rather than trusting an
 * optimistic guess forever if two tabs are open.
 */
export const useFollowTeacherMutation = (teacherSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teacherId: number) => postTeachersFollow({ teacherId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacherProfile", teacherSlug] });
    },
  });
};
