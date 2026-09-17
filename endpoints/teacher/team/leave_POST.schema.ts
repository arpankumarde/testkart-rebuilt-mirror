import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType = {
  success: boolean;
};

export const postTeacherTeamLeave = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/team/leave`, {
    method: "POST",
    body: superjson.stringify({}),
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