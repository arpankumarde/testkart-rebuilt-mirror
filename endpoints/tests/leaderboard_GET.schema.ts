import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  testItemId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type LeaderboardEntry = {
  rank: number;
  studentName: string;
  score: number;
  timeTaken: number; // in minutes
  completedAt: Date;
  attemptNumber: number;
};

export type OutputType = {
  leaderboard: LeaderboardEntry[];
  currentUserBestRank: LeaderboardEntry | null;
};

export const getTestsLeaderboard = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    testItemId: validatedParams.testItemId.toString(),
  });

  const result = await fetch(
    `/_api/tests/leaderboard?${searchParams.toString()}`,
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