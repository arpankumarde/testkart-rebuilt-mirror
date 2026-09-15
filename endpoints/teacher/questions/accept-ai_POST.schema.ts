import { z } from "zod";
import { GeneratedQuestionDraftSchema } from "./generate-ai_POST.schema";

// Persists the AI drafts a teacher accepted in the review step. The drafts are
// re-validated here rather than trusted, since they make a full round trip
// through the browser between generation and acceptance.
export const schema = z.object({
  subjectId: z.number().int().positive(),
  sectionId: z.number().int().positive().nullable().optional(),
  questions: z
    .array(GeneratedQuestionDraftSchema)
    .min(1, "Select at least one question to add.")
    .max(20, "You can add at most 20 questions at a time."),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  questionsAdded: number;
  questionIds: number[];
};

/**
 * Frontend helper to save the AI-generated questions the teacher accepted.
 *
 * @param body The request body matching InputType.
 * @returns A promise that resolves with the ids of the saved questions.
 */
export const postTeacherQuestionsAcceptAi = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const response = await fetch(`/_api/teacher/questions/accept-ai`, {
    method: "POST",
    body: JSON.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data as OutputType;
};
