import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTeacherDashboardOverview,
  TeacherOverviewRange,
} from "../endpoints/teacher/dashboard/overview_GET.schema";

export const TEACHER_OVERVIEW_QUERY_KEY = ["teacher", "dashboard-overview"] as const;

const STALE_TIME = 5 * 60 * 1000;

/**
 * One request feeds the whole teacher Overview (stage, needs-you rows, shelf,
 * money panel, chart and tables) plus the sidebar's counts and the create
 * chooser. Keyed by range so switching the period keeps each window's data
 * cached, and the previous window's numbers stay on screen while the next one
 * loads.
 *
 * The app default never refetches on mount, so the Overview passes
 * refetchOnMount "always": a teacher who just made a draft comes back to the
 * next step, not the one before it. The sidebar keeps the cached copy.
 */
export const useTeacherDashboardOverview = (
  range: TeacherOverviewRange = "30d",
  enabled = true,
  refetchOnMount: boolean | "always" = false
) => {
  return useQuery({
    queryKey: [...TEACHER_OVERVIEW_QUERY_KEY, range],
    queryFn: () => getTeacherDashboardOverview({ range }),
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous,
    enabled,
    refetchOnMount,
  });
};

export const useInvalidateTeacherOverview = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: TEACHER_OVERVIEW_QUERY_KEY });
};
