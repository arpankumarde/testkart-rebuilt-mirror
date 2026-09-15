import { z } from "zod";
import superjson from 'superjson';

export const schema = z.object({
  testItemId: z.coerce.number().int().positive({ message: "Test item ID must be a positive integer." }),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  testItem: {
    id: number;
    title: string;
    description: string | null;
    durationMinutes: number;
    totalQuestions: number;
    totalMarks: number;
    positiveMarks: number;
    negativeMarks: number;
    isFree: boolean;
    calculatorEnabled: boolean;
    subjectWiseTiming: boolean;
    questionWiseTiming: boolean;
    scheduledDate: Date | null;
  };
  package: {
    id: number;
    title: string;
    teacherName: string;
    thumbnailUrl: string | null;
  };
  subjects: Array<{
    id: number;
    subjectName: string;
    durationMinutes: number | null;
    questionCount: number;
    maxAttemptsAllowed: number | null;
    sections: Array<{
      id: number;
      sectionName: string;
      maxAttemptsAllowed: number | null;
      questionCount: number;
    }>;
  }>;
  access: {
    hasAccess: boolean;
    isFree: boolean;
  };
  previousAttempt: {
    hasAttempted: boolean;
    attemptCount: number;
    lastAttempt: {
      score: number | null;
      totalQuestions: number;
      startedAt: Date | null;
      completedAt: Date | null;
    } | null;
  };
};

export const getTestItemInstructions = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const queryParams = new URLSearchParams({
    testItemId: validatedInput.testItemId.toString(),
  });

  const result = await fetch(`/_api/student/test-item/instructions?${queryParams.toString()}`, {
    method: "GET",
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