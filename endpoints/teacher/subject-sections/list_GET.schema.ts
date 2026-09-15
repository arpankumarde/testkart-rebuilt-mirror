import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { SubjectSections } from "../../../helpers/schema";

export const schema = z.object({
  subjectId: z.coerce.number().int().positive("Subject ID must be a positive number."),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<SubjectSections>[];

export const getSubjectSectionsList = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams({
    subjectId: validatedParams.subjectId.toString(),
  });

  const result = await fetch(`/_api/teacher/subject-sections/list?${queryParams}`, {
    method: "GET",
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