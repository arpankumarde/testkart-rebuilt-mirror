import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogPosts } from "../../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type AdminPostDetail = Selectable<BlogPosts> & {
  tags: string[];
};

export type OutputType = {
  post: AdminPostDetail;
};

export const getAdminBlogPostDetail = async (id: number, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/blog/posts/get?id=${id}`, {
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