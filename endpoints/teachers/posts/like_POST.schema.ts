import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  postId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  likedByMe: boolean;
  likeCount: number;
};

export const postTeachersPostsLike = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teachers/posts/like`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      throw new Error(errorObject.error);
    } catch (e) {
      throw new Error(`Request failed with status ${result.status}`);
    }
  }

  return superjson.parse<OutputType>(await result.text());
};
