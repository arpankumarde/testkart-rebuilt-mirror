import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { QuestionBank } from "../../../helpers/schema";

const baseQuestionSchema = z.object({
  questionText: z.string().min(10, "Question text is too short."),
  positiveMarks: z.number().min(0, "Marks for a correct answer cannot be negative.").default(4),
  negativeMarks: z.number().min(0, "Enter the marks deducted for a wrong answer as a positive number, or 0.").default(0),
  explanation: z.string().optional().nullable(),
  durationSeconds: z.number().int().min(1).nullable().optional(),
  tags: z.array(z.string()).optional().nullable(),
  subjectName: z.string().optional().nullable(),
  examId: z.number().int().optional().nullable(),
});

const singleCorrectMcqSchema = baseQuestionSchema.extend({
  questionType: z.literal("single_correct_mcq"),
  optionA: z.string().min(1, "Option A cannot be empty."),
  optionB: z.string().min(1, "Option B cannot be empty."),
  optionC: z.string().min(1, "Option C cannot be empty."),
  optionD: z.string().min(1, "Option D cannot be empty."),
  optionE: z.string().optional().nullable(),
  correctOption: z.enum(["A", "B", "C", "D", "E"]),
 });

const multipleCorrectMcqSchema = baseQuestionSchema.extend({
  questionType: z.literal("multiple_correct_mcq"),
  optionA: z.string().min(1, "Option A cannot be empty."),
  optionB: z.string().min(1, "Option B cannot be empty."),
  optionC: z.string().min(1, "Option C cannot be empty."),
  optionD: z.string().min(1, "Option D cannot be empty."),
  correctOptions: z.array(z.enum(["A", "B", "C", "D", "E"])).min(1, "At least one correct option is required."),
  optionE: z.string().optional().nullable(),
  partialMarking: z.boolean().default(false),
});

const numericalSchema = baseQuestionSchema.extend({
  questionType: z.literal("numerical"),
  numericalAnswer: z.number(),
  numericalTolerance: z.number().default(0),
});

const matchTheFollowingSchema = baseQuestionSchema.extend({
  questionType: z.literal("match_the_following"),
  matchData: z.object({
    leftItems: z.array(z.string()).min(1, "At least one left item is required."),
    rightItems: z.array(z.string()).min(1, "At least one right item is required."),
    correctMatches: z.record(z.string(), z.string()),
  }),
});

const comprehensionSchema = baseQuestionSchema.extend({
  questionType: z.literal("comprehension"),
  paragraphText: z.string().min(10, "Paragraph text must be at least 10 characters long."),
  optionA: z.string().min(1, "Option A cannot be empty."),
  optionB: z.string().min(1, "Option B cannot be empty."),
  optionC: z.string().min(1, "Option C cannot be empty."),
  optionD: z.string().min(1, "Option D cannot be empty."),
  optionE: z.string().optional().nullable(),
  correctOption: z.enum(["A", "B", "C", "D", "E"]),
 });

const assertionReasonSchema = baseQuestionSchema.extend({
  questionType: z.literal("assertion_reason"),
  optionA: z.string().min(1, "Option A cannot be empty."),
  optionB: z.string().min(1, "Option B cannot be empty."),
  optionC: z.string().min(1, "Option C cannot be empty."),
  optionD: z.string().min(1, "Option D cannot be empty."),
  optionE: z.string().optional().nullable(),
  correctOption: z.enum(["A", "B", "C", "D", "E"]),
 });

export const schema = z.discriminatedUnion("questionType", [
  singleCorrectMcqSchema,
  multipleCorrectMcqSchema,
  numericalSchema,
  matchTheFollowingSchema,
  comprehensionSchema,
  assertionReasonSchema,
]);

export type InputType = z.infer<typeof schema>;
export type OutputType = Selectable<QuestionBank>;

export const postTeacherQuestionBankCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/question-bank/create`, {
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