import { z } from "zod";
import superjson from 'superjson';
import type { Selectable } from 'kysely';
import type { MockTestItems, MockTests } from '../../helpers/schema';

export const schema = z.object({
  testItemId: z.coerce.number().int().positive({ message: "Test item ID must be a positive integer." }),
});

export type InputType = z.infer<typeof schema>;

type TestItemSubjectDetail = {
  id: number;
  subjectName: string;
  durationMinutes: number | null;
  questionCount: number;
};

type TestItemDetails = Pick<
  Selectable<MockTestItems>,
  'id' | 'title' | 'durationMinutes' | 'isFree' | 'calculatorEnabled' | 'orderIndex' | 'scheduledDate' | 'createdAt' | 'subjectWiseTiming' | 'questionWiseTiming'
> & {
  totalQuestions: number;
  totalMarks: number;
  positiveMarks: number;
  negativeMarks: number;
  subjects: TestItemSubjectDetail[];
};

type PackageDetails = Pick<
  Selectable<MockTests>,
  'id' | 'title'
> & {
  teacherName: string;
};

export type OutputType = {
  item: TestItemDetails;
  package: PackageDetails;
};

export const getTestItemDetailsById = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const queryParams = new URLSearchParams({
    testItemId: validatedInput.testItemId.toString(),
  });

  const result = await fetch(`/_api/test-items/details?${queryParams.toString()}`, {
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