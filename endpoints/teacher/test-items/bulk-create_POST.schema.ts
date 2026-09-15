import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTestItems } from "../../../helpers/schema";

export const schema = z.object({
  packageId: z.number(),
  count: z.number().int().min(1).max(50),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<MockTestItems>[];

export const postTeacherTestItemsBulkCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/test-items/bulk-create`, {
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