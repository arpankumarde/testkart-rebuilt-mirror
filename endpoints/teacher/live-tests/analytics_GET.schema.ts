import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  liveTestId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type TopScorer = {
  studentName: string;
  score: number;
  timeTaken: number; // in minutes
};

export type OutputType = {
  enrolledCount: number;
  completedCount: number;
  averageScore: number;
  topScorers: TopScorer[];
};

export const getTeacherLiveTestsAnalytics = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    liveTestId: validatedParams.liveTestId.toString(),
  });

  const result = await fetch(
    `/_api/teacher/live-tests/analytics?${searchParams.toString()}`,
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