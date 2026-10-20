import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getBlogPostsList, InputType as PostsListInput } from "../endpoints/blog/list_GET.schema";
import { getBlogPostDetail } from "../endpoints/blog/post_GET.schema";
import { getBlogCategoriesList, InputType as CategoriesListInput } from "../endpoints/blog/categories_GET.schema";
import { getBlogCommentsList, InputType as CommentsListInput } from "../endpoints/blog/comments/list_GET.schema";
import { postCreateBlogComment, InputType as CreateCommentInput } from "../endpoints/blog/comments/create_POST.schema";
import { isNotFoundError } from "./isNotFoundError";

export const BLOG_POSTS_KEY = ["public", "blog", "posts"] as const;
export const BLOG_POST_KEY = (slug: string) => ["public", "blog", "post", slug] as const;
export const BLOG_CATEGORIES_KEY = ["public", "blog", "categories"] as const;
export const BLOG_COMMENTS_KEY = (postId: number) => ["public", "blog", "comments", postId] as const;

export const useBlogPostsQuery = (
  params: Omit<PostsListInput, "page"> & { page?: number },
  options?: { enabled?: boolean; keepPrevious?: boolean },
) => {
  const queryParams = { ...params, page: params.page ?? 1 };
  return useQuery({
    queryKey: [...BLOG_POSTS_KEY, queryParams],
    queryFn: () => getBlogPostsList(queryParams),
    // Matches the SSR prefetch (fetchBlogPostsListServer) so hydrated data
    // isn't immediately treated as stale and re-fetched on mount.
    staleTime: 60 * 1000,
    enabled: options?.enabled ?? true,
    // Keeps the last results on screen while the next search or filter loads,
    // instead of flashing a skeleton on every keystroke.
    placeholderData: options?.keepPrevious ? keepPreviousData : undefined,
  });
};

// Pages of the same list endpoint, for infinite scrolling. Each filter/search
// combination is its own key, so changing either starts a fresh list from
// page 1 and never appends to the previous one. pages/blog.prefetch.ts seeds
// the unfiltered key with page 1 for SSR.
export const useBlogPostsInfiniteQuery = (params: Omit<PostsListInput, "page">) => {
  return useInfiniteQuery({
    queryKey: [...BLOG_POSTS_KEY, "infinite", params],
    queryFn: ({ pageParam }) => getBlogPostsList({ ...params, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPageParam < lastPage.totalPages ? lastPageParam + 1 : undefined,
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
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 3,
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