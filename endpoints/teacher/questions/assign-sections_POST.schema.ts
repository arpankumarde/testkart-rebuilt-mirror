import { z } from "zod";
import superjson from "superjson";

export const assignmentEntrySchema = z.object({
  sectionId: z.number().nullable(),
  questionIds: z.array(z.number().int().positive()),
});

export const schema = z.object({
  subjectId: z.number().int().positive(),
  assignments: z.array(assignmentEntrySchema),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
};

export const postTeacherQuestionsAssignSections = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/questions/assign-sections`, {
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