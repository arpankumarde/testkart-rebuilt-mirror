import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  teacherSlug: z.string(),
});

export type InputType = z.infer<typeof schema>;

export type TeacherPostListItem = {
  id: number;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  likeCount: number;
  likedByMe: boolean;
};

export type OutputType = {
  // True when the viewer is not following this teacher, in which case
  // `posts` is always empty - posts are followers-only for now.
  locked: boolean;
  followerCount: number;
  posts: TeacherPostListItem[];
};

export const getTeachersPosts = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const params = new URLSearchParams({ teacherSlug: validatedInput.teacherSlug });

  const result = await fetch(`/_api/teachers/posts?${params.toString()}`, {
    method: "GET",
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
