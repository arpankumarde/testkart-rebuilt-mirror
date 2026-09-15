import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TestItemSubjects } from "../../../helpers/schema";

export const schema = z.object({
  testItemId: z.number().int().positive(),
  subjectName: z.string().min(1, "Subject name is required."),
  orderIndex: z.number().int().min(0).optional(),
  maxAttemptsAllowed: z.number().int().positive().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<TestItemSubjects>;

export const postTestItemSubjectsCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/test-item-subjects/create`, {
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