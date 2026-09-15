import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { TestQuestions } from "../../../helpers/schema";

export const schema = z.object({
  testItemId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

type SanitizedQuestion = Omit<
  Selectable<TestQuestions>,
  | "correctOption"
  | "correctOptions"
  | "numericalAnswer"
  | "explanation"
  | "numericalTolerance"
  | "createdAt"
  | "testId"
  | "markedForReview"
> & {
  subjectName: string | null;
  subjectOrderIndex: number | null;
  subjectMaxAttemptsAllowed: number | null;
  subjectDurationMinutes: number | null;
  sectionName: string | null;
  sectionOrderIndex: number | null;
  sectionMaxAttemptsAllowed: number | null;
};

export type OutputType = {
  calculatorEnabled: boolean;
  subjectWiseTiming: boolean;
  questionWiseTiming: boolean;
  questions: SanitizedQuestion[];
};

export const getStudentTestItemQuestions = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams({
    testItemId: validatedParams.testItemId.toString(),
  });

  const result = await fetch(
    `/_api/student/test-item/questions?${queryParams}`,
    {
      method: "GET",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    }
  );
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};