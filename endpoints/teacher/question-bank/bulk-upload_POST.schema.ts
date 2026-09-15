import { z } from "zod";
import superjson from "superjson";
import { QuestionTypeArrayValues } from "../../../helpers/schema";

const baseQuestionSchema = z.object({
  questionText: z.string().min(10, "Question text must be at least 10 characters long."),
  questionType: z.enum(QuestionTypeArrayValues).optional().default("single_correct_mcq"),
  positiveMarks: z.number().optional().default(4),
  // Spreadsheets usually write the deduction as "-1". Scoring always deducts,
  // so only the magnitude is stored.
  negativeMarks: z.number().optional().default(0).transform((value) => Math.abs(value)),
  explanation: z.string().optional().nullable(),
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
  optionE: z.string().optional().nullable(),
  correctOptions: z.array(z.enum(["A", "B", "C", "D", "E"])).min(1, "At least one correct option is required."),
  partialMarking: z.boolean().optional().default(false),
});

const numericalSchema = baseQuestionSchema.extend({
  questionType: z.literal("numerical"),
  numericalAnswer: z.number(),
  numericalTolerance: z.number().optional().default(0),
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

const questionSchema = z.discriminatedUnion("questionType", [
  singleCorrectMcqSchema,
  multipleCorrectMcqSchema,
  numericalSchema,
  comprehensionSchema,
  assertionReasonSchema,
]);

export const schema = z.object({
  subjectName: z.string().optional().nullable(),
  examId: z.number().int().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  questions: z.array(questionSchema).min(1, "At least one question is required for bulk upload."),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  count: number;
  questionIds: number[];
  message: string;
};

export const postTeacherQuestionBankBulkUpload = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/question-bank/bulk-upload`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: any }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};