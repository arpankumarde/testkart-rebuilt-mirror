import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { LiveTests, MockTestItems, MockTests, TestItemSubjects } from "../../../helpers/schema";

export const schema = z.object({
  liveTestId: z.coerce.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

type SubjectWithQuestionCount = Selectable<TestItemSubjects> & {
  actualQuestionCount: number;
};

export type OutputType = Selectable<LiveTests> & {
  mockTest: Selectable<MockTests> | null;
  mockTestItem: Selectable<MockTestItems> | null;
  subjects: SubjectWithQuestionCount[];
};

export const getTeacherLiveTestDetails = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const queryParams = new URLSearchParams({
    liveTestId: validatedParams.liveTestId.toString(),
  });

  const result = await fetch(`/_api/teacher/live-test/details?${queryParams}`, {
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