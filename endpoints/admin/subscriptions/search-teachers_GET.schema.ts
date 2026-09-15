import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  q: z.string().min(2),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  teachers: {
    id: number;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
  }[];
};

export const getSearchTeachers = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  queryParams.set("q", params.q);

  const result = await fetch(`/_api/admin/subscriptions/search-teachers?${queryParams.toString()}`, {
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