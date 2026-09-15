import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogComments } from "../../../helpers/schema";

export const schema = z.object({
  postId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type PublicCommentItem = Selectable<BlogComments> & {
  authorName: string;
  authorAvatar: string | null;
};

export type OutputType = {
  comments: PublicCommentItem[];
};

export const getBlogCommentsList = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input.postId) params.append("postId", input.postId.toString());

  const result = await fetch(`/_api/blog/comments/list?${params.toString()}`, {
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