import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type OutputType =
  | {
      success: boolean;
      message: string;
    }
  | {
      error: string;
      message?: string;
    };

export const postAdminLogout = async (
  body: z.infer<typeof schema> = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/logout`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return superjson.parse<OutputType>(await result.text());
};