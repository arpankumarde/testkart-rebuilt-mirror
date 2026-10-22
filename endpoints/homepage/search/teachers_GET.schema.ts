import { z } from "zod";
import superjson from "superjson";
import type { SearchTeacherItem } from "../search_GET.schema";

export const schema = z.object({
  q: z.string().min(1, "Search query is required"),
  limit: z.coerce.number().int().min(1).max(10).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  teachers: SearchTeacherItem[];
  total: number;
};

export const getHomepageSearchTeachers = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    q: validatedParams.q,
    limit: validatedParams.limit.toString(),
    offset: validatedParams.offset.toString(),
  });

  const result = await fetch(`/_api/homepage/search/teachers?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error || "Teacher search failed");
  }

  return superjson.parse<OutputType>(await result.text());
};