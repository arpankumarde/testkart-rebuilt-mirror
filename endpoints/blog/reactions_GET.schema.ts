import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  postId: z.number().int().positive(),
  sessionId: z.string().max(64).optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  likes: number;
  dislikes: number;
  userReaction: "like" | "dislike" | null;
};

export const getBlogReactions = async (
  input: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(input);
  const params = new URLSearchParams();
  params.set("postId", validatedInput.postId.toString());
  
  if (validatedInput.sessionId) {
    params.set("sessionId", validatedInput.sessionId);
  }

  const result = await fetch(`/_api/blog/reactions?${params.toString()}`, {
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