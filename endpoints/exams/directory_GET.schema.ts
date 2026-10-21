import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type DirectoryExam = {
  id: number;
  examName: string;
  fullName: string;
  examSlug: string;
};

export type DirectoryCategory = {
  id: number;
  categoryName: string;
  exams: DirectoryExam[];
};

// The /exams page's list: only the fields it shows, since the SSR pass embeds
// the whole list in the served HTML.
export type OutputType = {
  categories: DirectoryCategory[];
  // Exams with a published Exam News story in the last HOT_NEWS_DAYS days
  // (helpers/fetchExamDirectoryServer); /exams marks them "Hot".
  hotExamIds: number[];
};

export const getExamDirectory = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/exams/directory`, {
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
