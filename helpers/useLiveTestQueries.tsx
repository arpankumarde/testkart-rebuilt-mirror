import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherLiveTestDetails } from "../endpoints/teacher/live-test/details_GET.schema";
import { postTeacherLiveTestPublish } from "../endpoints/teacher/live-test/publish_POST.schema";
import { TEACHER_LIVE_TESTS_QUERY_KEY } from "./useTeacherLiveTestsQuery";
import { LIVE_TESTS_QUERY_KEY } from "./useLiveTestsQuery";
import { TEACHER_DASHBOARD_STATS_QUERY_KEY } from "./useTeacherDashboardStats";

export const getLiveTestDetailsQueryKey = (liveTestId: number) => ["teacher", "live-test-details", liveTestId];

export const useLiveTestDetailsQuery = (liveTestId: number | null) => {
  return useQuery({
    queryKey: getLiveTestDetailsQueryKey(liveTestId!),
    queryFn: () => getTeacherLiveTestDetails({ liveTestId: liveTestId! }),
    enabled: liveTestId !== null && !isNaN(liveTestId),
    // The editor seeds its form from this data and the question manager shows
    // its schedule and pool, and a live test can change from other screens
    // (list page publish, unpublish, another team member). Refetch on every
    // mount instead of trusting the app-wide 30 minute cache.
    refetchOnMount: "always",
  });
};

export const usePublishLiveTestMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postTeacherLiveTestPublish,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: getLiveTestDetailsQueryKey(variables.liveTestId),
      });
      queryClient.invalidateQueries({ queryKey: TEACHER_LIVE_TESTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LIVE_TESTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY });
    },
  });
};
