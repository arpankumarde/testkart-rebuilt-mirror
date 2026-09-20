import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogPosts } from "../../../../helpers/schema";

/*
 * Subsets the content dashboard links to. Each is the matching queue's condition
 * in endpoints/admin/content/dashboard_GET.ts minus its status, which travels
 * as the separate status input.
 */
export const AdminPostListFilterValues = ["missing-seo", "missing-og-image", "uncategorised", "stale"] as const;
export type AdminPostListFilter = (typeof AdminPostListFilterValues)[number];

export const AdminPostSortValues = ["title", "author", "status", "publishedAt", "viewCount", "readingTimeMinutes"] as const;
export type AdminPostSortBy = (typeof AdminPostSortValues)[number];

export const schema = z.object({
  search: z.string().optional(),
  type: z.enum(["blog", "knowledge_base"]).optional(),
  status: z.enum(["archived", "draft", "published"]).optional(),
  categoryId: z.number().int().positive().optional(),
  filter: z.enum(AdminPostListFilterValues).optional(),
  sortBy: z.enum(AdminPostSortValues).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type InputType = z.infer<typeof schema>;

export type AdminPostListItem = Selectable<BlogPosts> & {
  categoryName: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  tags: string[];
};

export type OutputType = {
  posts: AdminPostListItem[];
  total: number;
  totalPages: number;
};

export const getAdminBlogPostsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.search) params.append("search", input.search);
  if (input.type) params.append("type", input.type);
  if (input.status) params.append("status", input.status);
  if (input.categoryId) params.append("categoryId", input.categoryId.toString());
  if (input.filter) params.append("filter", input.filter);
  if (input.sortBy) params.append("sortBy", input.sortBy);
  if (input.sortOrder) params.append("sortOrder", input.sortOrder);
  if (input.page) params.append("page", input.page.toString());
  if (input.limit) params.append("limit", input.limit.toString());

  const result = await fetch(`/_api/admin/blog/posts/list?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};