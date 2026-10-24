import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type LeaderboardSeries = {
  id: number;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  examName: string | null;
  /** Why this student can see it: enrolled in the series, or attempted one of its papers. */
  access: "enrolled" | "attempted";
  items: Array<{ id: number; title: string }>;
};

export type OutputType = {
  series: LeaderboardSeries[];
};

export const getStudentLeaderboards = async (
  body: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/student/leaderboards`, {
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