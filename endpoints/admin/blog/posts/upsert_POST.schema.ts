import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogPosts } from "../../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(1, "Title is required"),
  slug: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().nullable().optional(),
  type: z.enum(["blog", "knowledge_base"]),
  categoryId: z.number().nullable().optional(),
  featuredImage: z.string().nullable().optional(),
  status: z.enum(["archived", "draft", "published"]),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  ogImage: z.string().nullable().optional(),
  isFeatured: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  // Omit to keep the current author; a new post defaults to the signed-in admin
  authorId: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  post: Selectable<BlogPosts>;
};

export const postAdminUpsertBlogPost = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/blog/posts/upsert`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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