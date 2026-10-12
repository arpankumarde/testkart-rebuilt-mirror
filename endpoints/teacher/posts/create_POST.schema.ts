import { z } from "zod";
import superjson from "superjson";
import type { TeacherOwnPostListItem } from "./list_GET.schema";

export const schema = z.object({
  body: z.string().trim().min(1, "Write something before posting.").max(2000, "Keep it under 2000 characters."),
  imageUrl: z.string().url().nullable().optional(),
  imageFileId: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  post: TeacherOwnPostListItem;
};

export const postTeacherPostsCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/posts/create`, {
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
