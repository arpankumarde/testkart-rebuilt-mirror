import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TestAttempts, TestQuestions, TestAttemptAnswers } from "../../../helpers/schema";

export const schema = z.object({
  testItemId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

type ResultItem = {
  questionId: Selectable<TestQuestions>["id"];
  questionText: string;
  questionType: Selectable<TestQuestions>["questionType"];
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  optionE: string | null;
  // Correct answer fields
  correctOption: string | null;
  correctOptions: string[] | null;
  correctNumericalAnswer: number | null;
  numericalTolerance: number | null;
  matchData: {
    correctMatches: Record<string, string>;
  } | null;
  paragraphText: string | null;
  positiveMarks: number | null;
  negativeMarks: number | null;
  partialMarking: boolean | null;
  explanation: string | null;
  // Student answer fields
  selectedOption: string | null;
  selectedOptions: string[] | null;
  studentNumericalAnswer: number | null;
  matchAnswers: Record<string, string> | null;
  isCorrect: boolean | null;
  marksObtained: number;
};

export type OutputType = {
  attemptId: Selectable<TestAttempts>["id"];
  score: number;
  totalMarks: number;
  maxPossibleMarks: number;
  correctAnswers: number;
  totalQuestions: Selectable<TestAttempts>["totalQuestions"];
  timeTaken: number; // in seconds
  completedAt: Selectable<TestAttempts>["completedAt"];
  mockTestId: number;
  testPackageTitle: string;
  results: ResultItem[];
};

export const getStudentTestAttemptsLatestResults = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    testItemId: validatedParams.testItemId.toString(),
  });

  const result = await fetch(`/_api/student/test-attempts/latest-results?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};