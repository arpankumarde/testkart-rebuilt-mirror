import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTestItems } from "../../../helpers/schema";

export const schema = z.object({
  itemId: z.number(),
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z.string().optional().nullable(),
  durationMinutes: z.number().int().min(0, "Duration must be 0 or more."),
  isFree: z.boolean(),
  calculatorEnabled: z.boolean().optional(),
  subjectWiseTiming: z.boolean().optional(),
  questionWiseTiming: z.boolean().optional(),
  subject: z.string().optional(),
  scheduledDate: z.date().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<MockTestItems>;

export const postTeacherTestItemsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/test-items/update`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};