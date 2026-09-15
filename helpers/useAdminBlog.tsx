import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { getAdminBlogCategoriesList } from "../endpoints/admin/blog/categories/list_GET.schema";
import { postAdminUpsertBlogCategory, InputType as UpsertCategoryInput } from "../endpoints/admin/blog/categories/upsert_POST.schema";
import { postAdminDeleteBlogCategory, InputType as DeleteCategoryInput } from "../endpoints/admin/blog/categories/delete_POST.schema";
import { getAdminBlogPostsList, InputType as PostsListInput } from "../endpoints/admin/blog/posts/list_GET.schema";
import { getAdminBlogPostDetail } from "../endpoints/admin/blog/posts/get_GET.schema";
import { postAdminUpsertBlogPost, InputType as UpsertPostInput } from "../endpoints/admin/blog/posts/upsert_POST.schema";
import { postAdminDeleteBlogPost, InputType as DeletePostInput } from "../endpoints/admin/blog/posts/delete_POST.schema";
import { getAdminBlogCommentsList, InputType as CommentsListInput } from "../endpoints/admin/blog/comments/list_GET.schema";
import { postAdminModerateBlogComment, InputType as ModerateCommentInput } from "../endpoints/admin/blog/comments/moderate_POST.schema";
import { getAdminBlogProductSearch, InputType as ProductSearchInput } from "../endpoints/admin/blog/product-search_GET.schema";

export const ADMIN_BLOG_CATEGORIES_KEY = ["admin", "blog", "categories"] as const;
export const ADMIN_BLOG_PRODUCT_SEARCH_KEY = ["admin", "blog", "productSearch"] as const;
export const ADMIN_BLOG_POSTS_KEY = ["admin", "blog", "posts"] as const;
export const ADMIN_BLOG_COMMENTS_KEY = ["admin", "blog", "comments"] as const;
export const ADMIN_BLOG_POST_DETAIL_KEY = (id: number) => ["admin", "blog", "post", id] as const;

export const useAdminBlogCategoriesQuery = () => {
  return useQuery({
    queryKey: ADMIN_BLOG_CATEGORIES_KEY,
    queryFn: () => getAdminBlogCategoriesList(),
  });
};

export const useAdminBlogPostsQuery = (params: Omit<PostsListInput, "page"> & { page?: number }) => {
  const queryParams = { ...params, page: params.page ?? 1 };
  return useQuery({
    queryKey: [...ADMIN_BLOG_POSTS_KEY, queryParams],
    queryFn: () => getAdminBlogPostsList(queryParams),
  });
};

export const useAdminBlogPostQuery = (id?: number) => {
  return useQuery({
    queryKey: ADMIN_BLOG_POST_DETAIL_KEY(id!),
    queryFn: () => getAdminBlogPostDetail(id!),
    enabled: !!id,
  });
};

export const useAdminBlogCommentsQuery = (params: CommentsListInput) => {
  return useQuery({
    queryKey: [...ADMIN_BLOG_COMMENTS_KEY, params],
    queryFn: () => getAdminBlogCommentsList(params),
  });
};

// Powers the "Insert Product" picker in the blog editor — searches published
// mock tests, study notes, courses, and bundles so an author can embed one or
// more of them inline in a post. Debounce the `query` value at the call site;
// this hook just reflects whatever params it's given.
export const useAdminBlogProductSearchQuery = (params: ProductSearchInput, enabled = true) => {
  return useQuery({
    queryKey: [...ADMIN_BLOG_PRODUCT_SEARCH_KEY, params],
    queryFn: () => getAdminBlogProductSearch(params),
    enabled,
  });
};

export const useUpsertBlogCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertCategoryInput) => postAdminUpsertBlogCategory(data),
    onSuccess: (data) => {
      toast.success(`Category "${data.category.name}" saved successfully.`);
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_POSTS_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
};

export const useDeleteBlogCategoryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeleteCategoryInput) => postAdminDeleteBlogCategory(data),
    onSuccess: () => {
      toast.success("Category deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_POSTS_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
};

export const useUpsertBlogPostMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertPostInput) => postAdminUpsertBlogPost(data),
    onSuccess: (data) => {
      toast.success(`Post "${data.post.title}" saved successfully.`);
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_POSTS_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_POST_DETAIL_KEY(data.post.id) });
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_CATEGORIES_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
};

export const useDeleteBlogPostMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DeletePostInput) => postAdminDeleteBlogPost(data),
    onSuccess: () => {
      toast.success("Post deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_POSTS_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_CATEGORIES_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
};

export const useAutoSaveBlogPostMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["admin", "blog", "autoSave"],
    mutationFn: (data: UpsertPostInput) => postAdminUpsertBlogPost(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_POSTS_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_CATEGORIES_KEY });
    },
  });
};

export const useModerateBlogCommentMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ModerateCommentInput) => postAdminModerateBlogComment(data),
    onSuccess: () => {
      toast.success("Comment moderated successfully.");
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_COMMENTS_KEY });
    },
    onError: (error) => {
      toast.error(parseErrorMessage(error));
    },
  });
};