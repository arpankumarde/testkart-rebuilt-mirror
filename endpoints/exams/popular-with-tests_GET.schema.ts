import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type PopularExam = {
  id: number;
  examName: string;
  examSlug: string;
  seriesCount: number;
};

export type OutputType = {
  exams: PopularExam[];
};

export const getPopularExamsWithTests = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/exams/popular-with-tests`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};