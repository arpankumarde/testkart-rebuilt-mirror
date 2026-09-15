import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type ExamSubjects } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number(),
  subjectName: z.string().min(1, "Subject name is required").optional(),
  subjectSlug: z.string().optional(),
  description: z.string().optional(),
  orderIndex: z.number().int().optional(),
  isActive: z.boolean().optional(),
  syllabusTopics: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  subject: Selectable<ExamSubjects>;
};

export const postAdminUpdateExamSubject = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exam-subjects/update`, {
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