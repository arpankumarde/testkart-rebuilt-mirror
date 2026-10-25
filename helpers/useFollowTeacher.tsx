import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postTeachersFollow } from "../endpoints/teachers/follow_POST.schema";
import type { OutputType as TeacherProfile } from "../endpoints/teachers/profile_GET.schema";

/**
 * Sets the current student's follow status for a teacher. The response
 * carries the new state and follower count, which go straight into the cached
 * profile so the button and count update at once; the profile and search
 * results are then invalidated so they settle to the server's view if two tabs
 * are open.
 */
export const useFollowTeacherMutation = (teacherSlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { teacherId: number; follow: boolean }) => postTeachersFollow(input),
    onSuccess: (result) => {
      queryClient.setQueryData<TeacherProfile>(["teacherProfile", teacherSlug], (old) =>
        old ? { ...old, isFollowing: result.isFollowing, followerCount: result.followerCount } : old
      );
      queryClient.invalidateQueries({ queryKey: ["teacherProfile", teacherSlug] });
      queryClient.invalidateQueries({ queryKey: ["homepage-search"] });
    },
  });
};