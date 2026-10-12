import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeachersPosts } from "../endpoints/teachers/posts_GET.schema";
import { postTeachersPostsLike } from "../endpoints/teachers/posts/like_POST.schema";

export const useTeacherPublicPostsQuery = (teacherSlug: string, enabled: boolean) =>
  useQuery({
    queryKey: ["teacherPublicPosts", teacherSlug],
    queryFn: () => getTeachersPosts({ teacherSlug }),
    enabled,
    staleTime: 60 * 1000,
  });

export const useLikeTeacherPostMutation = (teacherSlug: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => postTeachersPostsLike({ postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacherPublicPosts", teacherSlug] });
    },
  });
};
