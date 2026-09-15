import { getTestsLeaderboard } from "../endpoints/tests/leaderboard_GET.schema";
import { useQuery } from "@tanstack/react-query";

export const TEST_LEADERBOARD_QUERY_KEY_PREFIX = "testLeaderboard";

// Plain fetch-on-load — no realtime channel. The leaderboard reflects
// whatever was true the last time this page was loaded/refreshed; it
// doesn't auto-update while sitting open.
export const useTestLeaderboardQuery = (
  testItemId: number | undefined | null,
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: [TEST_LEADERBOARD_QUERY_KEY_PREFIX, testItemId],
    queryFn: () => getTestsLeaderboard({ testItemId: testItemId! }),
    enabled: !!testItemId && enabled,
  });
};