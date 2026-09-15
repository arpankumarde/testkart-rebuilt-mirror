import { z } from "zod";
import superjson from "superjson";
import { type Selectable } from "kysely";
import { type Exams } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number(),
  categoryId: z.number(),
  examName: z.string().min(3, "Exam name must be at least 3 characters"),
  fullName: z.string().min(3, "Full name must be at least 3 characters"),
  examSlug: z.string().optional(),
  description: z.string().optional().nullable(),
  orderIndex: z.number().int().optional(),
  aiGenerationPrompt: z.string().optional().nullable(),
  // Omit to leave the owner as it is; null unassigns.
  ownerTag: z.string().optional().nullable(),
  contentDueDate: z.date().optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  exam: Selectable<Exams>;
};

export const postAdminUpdateExam = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/exams/update`, {
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