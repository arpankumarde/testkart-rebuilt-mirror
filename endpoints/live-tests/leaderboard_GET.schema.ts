import { z } from "zod";
import superjson from "superjson";
import { PrizeTier } from "../../helpers/liveTestPrizeTiers";

export const schema = z.object({
  liveTestId: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type LeaderboardEntry = {
  rank: number;
  studentName: string;
  score: number;
  timeTaken: number; // in minutes
};

export type DynamicPrizes = {
  tiers: PrizeTier[];
  totalPrizePool: number;
  isReduced: boolean;
};

export type CurrentUserStatus =
  | "not_enrolled"
  | "enrolled_not_attempted"
  | "attempted";

export type OutputType = {
  leaderboard: LeaderboardEntry[];
  currentUserRank: LeaderboardEntry | null;
  currentUserStatus: CurrentUserStatus | null;
  testStatus: "not_started" | "ongoing" | "completed";
  dynamicPrizes: DynamicPrizes | null;
};

export const getLiveTestsLeaderboard = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedParams = schema.parse(params);
  const searchParams = new URLSearchParams({
    liveTestId: validatedParams.liveTestId.toString(),
  });

  const result = await fetch(
    `/_api/live-tests/leaderboard?${searchParams.toString()}`,
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