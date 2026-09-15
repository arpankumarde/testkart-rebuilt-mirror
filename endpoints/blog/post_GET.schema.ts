import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogPosts } from "../../helpers/schema";

export const schema = z.object({
  slug: z.string().min(1),
});

export type InputType = z.infer<typeof schema>;

export type PublicPostDetail = Selectable<BlogPosts> & {
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  authorAvatar: string | null;
  tags: string[];
};

export type OutputType = {
  post: PublicPostDetail;
};

export const getBlogPostDetail = async (slug: string, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/blog/post?slug=${encodeURIComponent(slug)}`, {
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