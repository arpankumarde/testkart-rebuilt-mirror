import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  prefix: z.string(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  totalFiles: number;
  files: Array<{
    key: string;
    size: number;
  }>;
  truncated: boolean;
};

export const postR2List = async (
  body: z.infer<typeof schema>,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/r2-list`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await result.text();

  if (!result.ok) {
    let errorMessage = "An error occurred";
    try {
      const errorObject = superjson.parse<{ error: string }>(text);
      errorMessage = errorObject.error;
    } catch {
      errorMessage = text || `HTTP Error ${result.status}`;
    }
    throw new Error(errorMessage);
  }

  return superjson.parse<OutputType>(text);
};