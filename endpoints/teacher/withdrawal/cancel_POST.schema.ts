import { z } from "zod";
import superjson from "superjson";
import type { OutputType as ListOutput } from "./list_GET.schema";

export const schema = z.object({
  withdrawalId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = ListOutput["withdrawals"][number];

export const postCancelTeacherWithdrawal = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/withdrawal/cancel`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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