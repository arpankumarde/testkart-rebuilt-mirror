import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TestItemSubjects } from "../../../helpers/schema";

export const schema = z.object({
  testItemId: z.number().int().positive(),
  subjectNames: z
    .array(z.string().min(1, "Subject name cannot be empty."))
    .min(1, "At least one subject name is required."),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  created: Selectable<TestItemSubjects>[];
  /** Requested names the item already had, compared case-insensitively. */
  skipped: string[];
};

export const postTestItemSubjectsBulkCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/test-item-subjects/bulk-create`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: any }>(
      await result.text()
    );
    console.error("Error in postTestItemSubjectsBulkCreate:", errorObject);
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};