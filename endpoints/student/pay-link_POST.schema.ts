import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.input<typeof schema>;

export type OutputType = {
  url: string;
  expiresAt: Date;
  amount: number;
  itemCount: number;
  shareText: string;
};

export const postStudentPayLink = async (body: InputType = {}, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/student/pay-link`, {
    method: "POST",
    body: superjson.stringify(body),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const parsed = superjson.parse<OutputType | { error: string }>(await result.text());
  if (!result.ok || "error" in (parsed as object)) throw new Error((parsed as { error?: string }).error ?? "Could not create the link");
  return parsed as OutputType;
};
