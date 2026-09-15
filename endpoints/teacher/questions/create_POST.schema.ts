import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TestQuestions } from "../../../helpers/schema";

const EMBEDDED_CONTENT = /<(img|video|iframe)\b|data-product-embed|data-latex=|data-type="(inline-math|block-math|mathematics)"/i;

// The rich text editor saves "<p></p>" for a field the teacher cleared, which
// passes a plain length check. Images, videos and formulas count as content.
export const richTextHasContent = (html: string | null | undefined): boolean => {
  if (!html) return false;
  if (EMBEDDED_CONTENT.test(html)) return true;
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").trim().length > 0;
};

const richText = (message: string) =>
  z.string({ required_error: message, invalid_type_error: message }).refine(richTextHasContent, message);

const optionalRichText = z.string().optional().nullable();

const OPTION_LETTERS = ["A", "B", "C", "D", "E"] as const;

export const questionFieldRules = {
  questionText: richText("Enter the question text."),
  paragraphText: richText("Enter the passage for this comprehension question."),
  option: (letter: string) => richText(`Option ${letter} cannot be empty.`),
  correctOption: z.enum(OPTION_LETTERS, {
    errorMap: () => ({ message: "Mark the correct answer." }),
  }),
  correctOptions: z
    .array(z.enum(OPTION_LETTERS), { invalid_type_error: "Mark at least one correct option." })
    .min(1, "Mark at least one correct option."),
  numericalAnswer: z
    .number({ required_error: "Enter the numerical answer.", invalid_type_error: "Enter the numerical answer." })
    .finite("Enter the numerical answer."),
  numericalTolerance: z
    .number({ invalid_type_error: "Enter a tolerance of 0 or more." })
    .min(0, "Tolerance cannot be negative."),
  positiveMarks: z
    .number({ invalid_type_error: "Enter the marks for a correct answer." })
    .min(0, "Marks for a correct answer cannot be negative."),
  negativeMarks: z
    .number({ invalid_type_error: "Enter the marks deducted for a wrong answer, or 0." })
    .min(0, "Negative marks are the marks deducted for a wrong answer. Enter them without a minus sign."),
  durationSeconds: z
    .number({ invalid_type_error: "Enter the time for this question in seconds." })
    .int("Enter the time for this question in whole seconds.")
    .min(1, "The time for this question must be at least 1 second.")
    .nullable()
    .optional(),
  matchData: z
    .object({
      leftItems: z.array(z.string()).min(1, "Add at least one item to column A."),
      rightItems: z.array(z.string()).min(1, "Add at least one item to column B."),
      correctMatches: z.record(z.string(), z.string()),
    })
    .superRefine((data, ctx) => {
      data.leftItems.forEach((item, index) => {
        if (!item.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["leftItems", index], message: `Item ${index + 1} in column A is empty.` });
        }
      });
      data.rightItems.forEach((item, index) => {
        if (!item.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rightItems", index],
            message: `Item ${String.fromCharCode(65 + index)} in column B is empty.`,
          });
        }
      });
      data.leftItems.forEach((_, index) => {
        const match = data.correctMatches[String(index)];
        const rightIndex = match === undefined ? NaN : Number(match);
        if (!Number.isInteger(rightIndex) || rightIndex < 0 || rightIndex >= data.rightItems.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["correctMatches", String(index)],
            message: `Choose the match for item ${index + 1}.`,
          });
        }
      });
    }),
};

const baseQuestionSchema = z.object({
  subjectId: z.number(),
  sectionId: z.number().int().positive().nullable().optional(),
  questionText: questionFieldRules.questionText,
  positiveMarks: questionFieldRules.positiveMarks.default(4),
  negativeMarks: questionFieldRules.negativeMarks.default(0),
  explanation: z.string().optional().nullable(),
  durationSeconds: questionFieldRules.durationSeconds,
});

const optionFields = {
  optionA: questionFieldRules.option("A"),
  optionB: questionFieldRules.option("B"),
  optionC: questionFieldRules.option("C"),
  optionD: questionFieldRules.option("D"),
  optionE: optionalRichText,
};

const singleCorrectMcqSchema = baseQuestionSchema.extend({
  questionType: z.literal("single_correct_mcq"),
  ...optionFields,
  correctOption: questionFieldRules.correctOption,
});

const multipleCorrectMcqSchema = baseQuestionSchema.extend({
  questionType: z.literal("multiple_correct_mcq"),
  ...optionFields,
  correctOptions: questionFieldRules.correctOptions,
  partialMarking: z.boolean().default(false),
});

const numericalSchema = baseQuestionSchema.extend({
  questionType: z.literal("numerical"),
  numericalAnswer: questionFieldRules.numericalAnswer,
  numericalTolerance: questionFieldRules.numericalTolerance.default(0),
});

const matchTheFollowingSchema = baseQuestionSchema.extend({
  questionType: z.literal("match_the_following"),
  matchData: questionFieldRules.matchData,
});

const comprehensionSchema = baseQuestionSchema.extend({
  questionType: z.literal("comprehension"),
  paragraphText: questionFieldRules.paragraphText,
  ...optionFields,
  correctOption: questionFieldRules.correctOption,
});

const assertionReasonSchema = baseQuestionSchema.extend({
  questionType: z.literal("assertion_reason"),
  ...optionFields,
  correctOption: questionFieldRules.correctOption,
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

export type OutputType = Selectable<TestQuestions>;

export const postTeacherQuestionsCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/questions/create`, {
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
