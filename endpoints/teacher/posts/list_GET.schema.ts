import superjson from "superjson";

export type TeacherOwnPostListItem = {
  id: number;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  likeCount: number;
};

export type OutputType = {
  posts: TeacherOwnPostListItem[];
  followerCount: number;
};

export const getTeacherPostsList = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/posts/list`, {
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
