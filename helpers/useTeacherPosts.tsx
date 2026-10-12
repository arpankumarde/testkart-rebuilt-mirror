import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherPostsList } from "../endpoints/teacher/posts/list_GET.schema";
import { postTeacherPostsCreate, InputType as CreatePostInput } from "../endpoints/teacher/posts/create_POST.schema";
import { postTeacherPostsDelete } from "../endpoints/teacher/posts/delete_POST.schema";

const QUERY_KEY = ["teacherOwnPosts"] as const;

export const useTeacherPostsQuery = () =>
  useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getTeacherPostsList(),
    staleTime: 60 * 1000,
  });

export const useCreateTeacherPostMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => postTeacherPostsCreate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};

export const useDeleteTeacherPostMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => postTeacherPostsDelete({ postId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
};
