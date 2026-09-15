import { useQuery } from "@tanstack/react-query";
import { getLiveTestsLeaderboard, OutputType } from "../endpoints/live-tests/leaderboard_GET.schema";

export const LIVE_TEST_LEADERBOARD_QUERY_KEY_PREFIX = "liveTestLeaderboard";

// Plain fetch-on-load — no realtime channel. The leaderboard reflects
// whatever was true the last time this page was loaded/refreshed; it
// doesn't auto-update while sitting open.
export const useLiveTestLeaderboardQuery = (
  liveTestId: number | undefined | null,
  enabled: boolean = true
) => {
  return useQuery<OutputType>({
    queryKey: [LIVE_TEST_LEADERBOARD_QUERY_KEY_PREFIX, liveTestId],
    queryFn: () => getLiveTestsLeaderboard({ liveTestId: liveTestId! }),
    enabled: !!liveTestId && enabled,
  });
};