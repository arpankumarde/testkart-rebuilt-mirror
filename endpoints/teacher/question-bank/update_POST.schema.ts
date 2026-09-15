import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { QuestionBank } from "../../../helpers/schema";

const baseQuestionUpdateSchema = z.object({
  questionId: z.number().int().positive(),
  questionText: z.string().min(10, "Question text is too short.").optional(),
  positiveMarks: z.number().min(0, "Marks for a correct answer cannot be negative.").optional(),
  negativeMarks: z.number().min(0, "Enter the marks deducted for a wrong answer as a positive number, or 0.").optional(),
  explanation: z.string().optional().nullable(),
  durationSeconds: z.number().int().min(1).nullable().optional(),
  tags: z.array(z.string()).optional().nullable(),
  subjectName: z.string().optional().nullable(),
  examId: z.number().int().optional().nullable(),
});

const singleCorrectMcqUpdateSchema = baseQuestionUpdateSchema.extend({
  questionType: z.literal("single_correct_mcq").optional(),
  optionA: z.string().min(1).optional(),
  optionB: z.string().min(1).optional(),
  optionC: z.string().min(1).optional(),
  optionD: z.string().min(1).optional(),
  optionE: z.string().optional().nullable(),
  correctOption: z.enum(["A", "B", "C", "D", "E"]).optional(),
});

const multipleCorrectMcqUpdateSchema = baseQuestionUpdateSchema.extend({
  questionType: z.literal("multiple_correct_mcq").optional(),
  optionA: z.string().min(1).optional(),
  optionB: z.string().min(1).optional(),
  optionC: z.string().min(1).optional(),
  optionD: z.string().min(1).optional(),
  correctOptions: z.array(z.enum(["A", "B", "C", "D", "E"])).min(1).optional(),
  optionE: z.string().optional().nullable(),
  partialMarking: z.boolean().optional(),
});

const numericalUpdateSchema = baseQuestionUpdateSchema.extend({
  questionType: z.literal("numerical").optional(),
  numericalAnswer: z.number().optional(),
  numericalTolerance: z.number().optional(),
});

const matchTheFollowingUpdateSchema = baseQuestionUpdateSchema.extend({
  questionType: z.literal("match_the_following").optional(),
  matchData: z.object({
    leftItems: z.array(z.string()).min(1),
    rightItems: z.array(z.string()).min(1),
    correctMatches: z.record(z.string(), z.string()),
  }).optional(),
});

const comprehensionUpdateSchema = baseQuestionUpdateSchema.extend({
  questionType: z.literal("comprehension").optional(),
  paragraphText: z.string().min(10).optional(),
  optionA: z.string().min(1).optional(),
  optionB: z.string().min(1).optional(),
  optionC: z.string().min(1).optional(),
  optionD: z.string().min(1).optional(),
  optionE: z.string().optional().nullable(),
  correctOption: z.enum(["A", "B", "C", "D", "E"]).optional(),
});

const assertionReasonUpdateSchema = baseQuestionUpdateSchema.extend({
  questionType: z.literal("assertion_reason").optional(),
  optionA: z.string().min(1).optional(),
  optionB: z.string().min(1).optional(),
  optionC: z.string().min(1).optional(),
  optionD: z.string().min(1).optional(),
  optionE: z.string().optional().nullable(),
  correctOption: z.enum(["A", "B", "C", "D", "E"]).optional(),
});

export const schema = z.union([
  singleCorrectMcqUpdateSchema,
  multipleCorrectMcqUpdateSchema,
  numericalUpdateSchema,
  matchTheFollowingUpdateSchema,
  comprehensionUpdateSchema,
  assertionReasonUpdateSchema,
]).superRefine((data, ctx) => {
  // basic validations specific to the passed type if provided
});

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<QuestionBank>;

export const postTeacherQuestionBankUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/question-bank/update`, {
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