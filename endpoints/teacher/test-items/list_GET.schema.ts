import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { MockTestItems } from "../../../helpers/schema";

export const schema = z.object({
  packageId: z.coerce.number().int().positive("Package ID must be a positive number."),
});

export type InputType = z.infer<typeof schema>;

export type TestItemWithQuestionsCount = Selectable<MockTestItems> & {
  questionsCount: number;
  totalSubjectDurationMinutes: number | null;
  subjectsCount: number;
  totalQuestionDurationMinutes: number | null;
  // Validation hints, surfaced inline on the item card so a teacher doesn't
  // have to open every item (or wait for the review step) to spot problems.
  missingAnswerCount: number;
  minSubjectQuestionCount: number | null;
  maxSubjectQuestionCount: number | null;
};

export type OutputType = TestItemWithQuestionsCount[];

export const getTeacherTestItemsList = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const queryParams = new URLSearchParams({
    packageId: validatedInput.packageId.toString(),
  });

  const result = await fetch(`/_api/teacher/test-items/list?${queryParams}`, {
    method: "GET",
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