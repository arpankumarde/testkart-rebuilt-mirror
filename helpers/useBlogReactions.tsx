import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBlogReactions } from "../endpoints/blog/reactions_GET.schema";
import { postBlogReact, InputType as PostReactInput, OutputType as PostReactOutput } from "../endpoints/blog/react_POST.schema";

export const useBlogReactions = (postId: number, sessionId?: string | null) => {
  return useQuery({
    queryKey: ["blogReactions", postId, sessionId],
    queryFn: () =>
      getBlogReactions({
        postId,
        ...(sessionId ? { sessionId } : {}),
      }),
    enabled: !!postId,
  });
};

export const useBlogReactMutation = () => {
  const queryClient = useQueryClient();
  return useMutation<PostReactOutput, Error, PostReactInput>({
    mutationFn: postBlogReact,
    onSuccess: (data, variables) => {
      // Invalidate the specific GET query based on post ID so it fetches updated counts
      queryClient.invalidateQueries({
        queryKey: ["blogReactions", variables.postId],
      });
      // Optionally could manually update cache, but invalidation is fine here
    },
  });
};