import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  type: z.enum(["blog", "knowledge_base"]).default("blog"),
  categorySlug: z.string().optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(12),
});

export type InputType = z.infer<typeof schema>;

export type PublicPostListItem = {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  type: "blog" | "knowledge_base";
  categoryName: string | null;
  categorySlug: string | null;
  featuredImage: string | null;
  publishedAt: Date | null;
  readingTimeMinutes: number;
  viewCount: number;
  authorName: string | null;
  authorAvatar: string | null;
  tags: string[];
  isFeatured: boolean;
};

export type OutputType = {
  posts: PublicPostListItem[];
  total: number;
  totalPages: number;
};

export const getBlogPostsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.type) params.append("type", input.type);
  if (input.categorySlug) params.append("categorySlug", input.categorySlug);
  if (input.search) params.append("search", input.search);
  if (input.tag) params.append("tag", input.tag);
  if (input.page) params.append("page", input.page.toString());
  if (input.limit) params.append("limit", input.limit.toString());

  const result = await fetch(`/_api/blog/list?${params.toString()}`, {
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