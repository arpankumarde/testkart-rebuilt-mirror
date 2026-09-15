import { z } from "zod";
export const schema = z.object({
  subjectId: z.number().int().positive(),
  examName: z.string().min(1, "Exam name is required."),
  subjectName: z.string().min(1, "Subject name is required."),
  numberOfQuestions: z.number().int().min(1).max(20, "Number of questions must be between 1 and 20."),
  customPrompt: z.string().optional(),
  chapterTopic: z.string().optional(),
  syllabus: z.string().optional(),
  questionType: z.enum(['single_correct_mcq', 'multiple_correct_mcq', 'numerical']).default('single_correct_mcq'),
  positiveMarks: z.number().min(0).optional(),
  negativeMarks: z.number().min(0).optional(),
  language: z.enum(['english', 'hindi', 'bilingual']).default('english'),
  includeExplanation: z.boolean().default(true),
});

export type InputType = z.infer<typeof schema>;

// This schema validates the JSON structure we expect from the AI
export const AiResponseSchema = z.array(
  z.object({
    questionText: z.string(),
    optionA: z.string().optional(),
    optionB: z.string().optional(),
    optionC: z.string().optional(),
    optionD: z.string().optional(),
    correctOption: z.enum(["A", "B", "C", "D", "E"]).optional(),
    correctOptions: z.array(z.string()).optional(),
    numericalAnswer: z.union([z.number(), z.string()]).optional(),
    numericalTolerance: z.union([z.number(), z.string()]).optional(),
    explanation: z.string().optional(),
  })
);

// A generated-but-not-yet-saved question. This endpoint no longer writes to the
// database: it returns drafts for the teacher to review, and only the ones they
// accept are persisted by `accept-ai_POST`. Field shapes match the columns that
// endpoint writes so the round trip is lossless.
export const GeneratedQuestionDraftSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['single_correct_mcq', 'multiple_correct_mcq', 'numerical']),
  optionA: z.string().nullable(),
  optionB: z.string().nullable(),
  optionC: z.string().nullable(),
  optionD: z.string().nullable(),
  correctOption: z.enum(["A", "B", "C", "D", "E"]).nullable(),
  correctOptions: z.array(z.string()).nullable(),
  numericalAnswer: z.number().nullable(),
  numericalTolerance: z.number().nullable(),
  explanation: z.string().nullable(),
  positiveMarks: z.number().nullable(),
  // Scoring always deducts, so a draft never stores a signed deduction.
  negativeMarks: z.number().nullable().transform((value) => (value == null ? value : Math.abs(value))),
});

export type GeneratedQuestionDraft = z.infer<typeof GeneratedQuestionDraftSchema>;

export type OutputType = {
  success: true;
  questionsGenerated: number;
  questions: GeneratedQuestionDraft[];
};

/**
 * Frontend helper to generate AI questions.
 *
 * Nothing is saved by this call — the returned questions are drafts the teacher
 * reviews before accepting. Use `postTeacherQuestionsAcceptAi` to persist them.
 *
 * @param body The request body matching InputType.
 * @returns A promise that resolves with the generated drafts, or rejects on error.
 */
export const postTeacherQuestionsGenerateAi = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const response = await fetch(`/_api/teacher/questions/generate-ai`, {
    method: "POST",
        body: JSON.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data as OutputType;
};
