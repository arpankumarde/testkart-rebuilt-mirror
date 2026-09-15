import { z } from "zod";
import superjson from "superjson";

// No input parameters required
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type TeacherAvatar = {
  displayName: string;
  avatarUrl: string | null;
};

export type OutputType = {
  teachers: TeacherAvatar[];
};

export const getTeacherAvatars = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teachers/avatars`, {
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