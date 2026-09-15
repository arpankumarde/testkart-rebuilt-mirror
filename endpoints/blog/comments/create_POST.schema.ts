import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { BlogComments } from "../../../helpers/schema";

export const schema = z.object({
  postId: z.number().int().positive(),
  content: z.string().min(1, "Comment content cannot be empty"),
  parentId: z.number().int().positive().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  comment: Selectable<BlogComments>;
};

export const postCreateBlogComment = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/blog/comments/create`, {
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