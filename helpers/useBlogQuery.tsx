import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getBlogPostsList, InputType as PostsListInput } from "../endpoints/blog/list_GET.schema";
import { getBlogPostDetail } from "../endpoints/blog/post_GET.schema";
import { getBlogCategoriesList, InputType as CategoriesListInput } from "../endpoints/blog/categories_GET.schema";
import { getBlogCommentsList, InputType as CommentsListInput } from "../endpoints/blog/comments/list_GET.schema";
import { postCreateBlogComment, InputType as CreateCommentInput } from "../endpoints/blog/comments/create_POST.schema";

export const BLOG_POSTS_KEY = ["public", "blog", "posts"] as const;
export const BLOG_POST_KEY = (slug: string) => ["public", "blog", "post", slug] as const;
export const BLOG_CATEGORIES_KEY = ["public", "blog", "categories"] as const;
export const BLOG_COMMENTS_KEY = (postId: number) => ["public", "blog", "comments", postId] as const;

export const useBlogPostsQuery = (params: Omit<PostsListInput, "page"> & { page?: number }) => {
  const queryParams = { ...params, page: params.page ?? 1 };
  return useQuery({
    queryKey: [...BLOG_POSTS_KEY, queryParams],
    queryFn: () => getBlogPostsList(queryParams),
    // Matches the SSR prefetch (fetchBlogPostsListServer) so hydrated data
    // isn't immediately treated as stale and re-fetched on mount.
    staleTime: 60 * 1000,
  });
};

export const useBlogPostQuery = (slug?: string) => {
  return useQuery({
    queryKey: BLOG_POST_KEY(slug!),
    queryFn: () => getBlogPostDetail(slug!),
    enabled: !!slug,
    // The SSR prefetch (fetchBlogPostDetailServer) already resolved this
    // exact query key and incremented the view count server-side. Without a
    // staleTime, react-query treats hydrated data as stale by default and
    // immediately re-fetches on mount, which would double-count the view and
    // do a redundant round trip. 10 minutes matches useTestDetailsQuery and
    // the other SSR-prefetched detail pages.
    staleTime: 10 * 60 * 1000,
  });
};

export const useBlogCategoriesQuery = (params: CategoriesListInput) => {
  return useQuery({
    queryKey: [...BLOG_CATEGORIES_KEY, params],
    queryFn: () => getBlogCategoriesList(params),
    // Matches the SSR prefetch (fetchBlogCategoriesServer) so hydrated data
    // isn't immediately treated as stale and re-fetched on mount.
    staleTime: 60 * 1000,
  });
};

export const useBlogCommentsQuery = (params: CommentsListInput) => {
  return useQuery({
    queryKey: BLOG_COMMENTS_KEY(params.postId!),
    queryFn: () => getBlogCommentsList(params),
    enabled: !!params.postId,
  });
};

export const useCreateBlogCommentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCommentInput) => postCreateBlogComment(data),
    onSuccess: (data) => {
      toast.success("Comment submitted and is awaiting moderation.");
      queryClient.invalidateQueries({ queryKey: BLOG_COMMENTS_KEY(data.comment.postId) });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
};