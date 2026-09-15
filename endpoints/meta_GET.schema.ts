import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  fields: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Record<string, string | null>;

export const getMeta = async (
  input?: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams();
  if (input?.fields) {
    params.set("fields", input.fields);
  }
  const queryString = params.toString();
  const url = queryString ? `/_api/meta?${queryString}` : `/_api/meta`;

  const result = await fetch(url, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    let errorMessage = "Failed to fetch meta fields";
    try {
      const errorObject = superjson.parse<{ error: string }>(await result.text());
      errorMessage = errorObject.error || errorMessage;
    } catch {
      // ignore parse error if response is not valid superjson
    }
    throw new Error(errorMessage);
  }

  return superjson.parse<OutputType>(await result.text());
};