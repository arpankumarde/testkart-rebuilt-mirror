import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  testItemId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type PreviewQuestion = {
  id: number;
  questionType: string;
  questionText: string;
  paragraphText: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
  correctOption: string | null;
  correctOptions: string[] | null;
  numericalAnswer: number | null;
  numericalTolerance: number | null;
  matchData: unknown;
  explanation: string | null;
  positiveMarks: number | null;
  negativeMarks: number | null;
  isAiGenerated: boolean;
  subjectName: string | null;
};

export type OutputType = { questions: PreviewQuestion[] };

export const getAdminContentPreviewQuestions = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validated = schema.parse(params);
  const searchParams = new URLSearchParams({ testItemId: String(validated.testItemId) });
  const result = await fetch(`/_api/admin/content-preview/questions?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};