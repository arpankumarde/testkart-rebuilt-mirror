import { z } from "zod";
import superjson from "superjson";

const singleAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  answerType: z.literal('single'),
  selectedOption: z.enum(["A", "B", "C", "D", "E"]),
});

const multipleAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  answerType: z.literal('multiple'),
  selectedOptions: z.array(z.enum(["A", "B", "C", "D", "E"])).max(5),
});

const numericalAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  answerType: z.literal('numerical'),
  numericalAnswer: z.number(),
});

const matchAnswerSchema = z.object({
  questionId: z.number().int().positive(),
  answerType: z.literal('match'),
  matchAnswers: z.record(z.string(), z.string()),
});

const answerSchema = z.discriminatedUnion('answerType', [
  singleAnswerSchema,
  multipleAnswerSchema,
  numericalAnswerSchema,
  matchAnswerSchema,
]);

export const schema = z.object({
  attemptId: z.number().int().positive(),
  answers: z.array(answerSchema),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  score: number;
  totalMarks: number;
  maxPossibleMarks: number;
  totalQuestions: number;
  correctAnswers: number;
  timeTakenSeconds: number;
  results: Array<{
    questionId: number;
    questionType: 'single_correct_mcq' | 'multiple_correct_mcq' | 'numerical' | 'assertion_reason' | 'comprehension' | 'match_the_following';
    // null means the question was not attempted; false means attempted but wrong.
    isCorrect: boolean | null;
    marksObtained: number;
    correctOption: string | null;
    selectedOption: string | null;
    correctOptions: string[] | null;
    selectedOptions: string[] | null;
    correctNumericalAnswer: number | null;
    studentNumericalAnswer: number | null;
    numericalTolerance: number | null;
    matchData: {
      correctMatches: Record<string, string>;
    } | null;
    matchAnswers: Record<string, string> | null;
    explanation: string | null;
  }>;
};

export const postStudentTestItemSubmitAttempt = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/student/test-item/submit-attempt`, {
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