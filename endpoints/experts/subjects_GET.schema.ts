import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});
export type InputType = z.infer<typeof schema>;

export type ExpertSubject = {
  /** A subject or exam as tutors wrote it on their profile (expertise areas and teaching categories). */
  label: string;
  /** Bookable tutors who list it. */
  count: number;
};

export type OutputType = {
  subjects: ExpertSubject[];
};

export const getExpertSubjects = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/experts/subjects`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};