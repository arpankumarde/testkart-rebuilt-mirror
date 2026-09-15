import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { SubjectSections } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive(),
  sectionName: z.string().min(1, "Section name is required.").optional(),
  maxAttemptsAllowed: z.number().int().positive().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<SubjectSections>;

export const postSubjectSectionsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/subject-sections/update`, {
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