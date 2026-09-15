import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TestQuestions } from "../../../helpers/schema";
import { questionFieldRules } from "./create_POST.schema";

// An update carries the full set of fields for the question's type, so a type
// change can never leave the row half-converted. Keying the union on
// questionType also gives each validation error a real field path instead of
// the bare "Invalid input" a plain union reports.
const baseQuestionUpdateSchema = z.object({
  questionId: z.number(),
  subjectId: z.number().optional(),
  sectionId: z.number().int().positive().nullable().optional(),
  questionText: questionFieldRules.questionText,
  positiveMarks: questionFieldRules.positiveMarks,
  negativeMarks: questionFieldRules.negativeMarks,
  explanation: z.string().optional().nullable(),
  durationSeconds: questionFieldRules.durationSeconds,
});

const optionFields = {
  optionA: questionFieldRules.option("A"),
  optionB: questionFieldRules.option("B"),
  optionC: questionFieldRules.option("C"),
  optionD: questionFieldRules.option("D"),
  optionE: z.string().optional().nullable(),
};

export const schema = z.discriminatedUnion("questionType", [
  baseQuestionUpdateSchema.extend({
    questionType: z.literal("single_correct_mcq"),
    ...optionFields,
    correctOption: questionFieldRules.correctOption,
  }),
  baseQuestionUpdateSchema.extend({
    questionType: z.literal("multiple_correct_mcq"),
    ...optionFields,
    correctOptions: questionFieldRules.correctOptions,
    partialMarking: z.boolean().default(false),
  }),
  baseQuestionUpdateSchema.extend({
    questionType: z.literal("numerical"),
    numericalAnswer: questionFieldRules.numericalAnswer,
    numericalTolerance: questionFieldRules.numericalTolerance.default(0),
  }),
  baseQuestionUpdateSchema.extend({
    questionType: z.literal("match_the_following"),
    matchData: questionFieldRules.matchData,
  }),
  baseQuestionUpdateSchema.extend({
    questionType: z.literal("comprehension"),
    paragraphText: questionFieldRules.paragraphText,
    ...optionFields,
    correctOption: questionFieldRules.correctOption,
  }),
  baseQuestionUpdateSchema.extend({
    questionType: z.literal("assertion_reason"),
    ...optionFields,
    correctOption: questionFieldRules.correctOption,
  }),
]);

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<TestQuestions>;

export const postTeacherQuestionsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/questions/update`, {
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
