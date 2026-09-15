import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getTeacherDashboardOverview,
  TeacherOverviewRange,
} from "../endpoints/teacher/dashboard/overview_GET.schema";

export const TEACHER_OVERVIEW_QUERY_KEY = ["teacher", "dashboard-overview"] as const;

const STALE_TIME = 5 * 60 * 1000;

/**
 * One request feeds the whole teacher dashboard — attention queues, KPIs, the
 * chart, the tables and the totals footer. Keyed by range so switching the
 * period keeps each window's data cached, and the previous window's numbers
 * stay on screen while the next one loads.
 */
export const useTeacherDashboardOverview = (range: TeacherOverviewRange = "30d", enabled = true) => {
  return useQuery({
    queryKey: [...TEACHER_OVERVIEW_QUERY_KEY, range],
    queryFn: () => getTeacherDashboardOverview({ range }),
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous,
    enabled,
  });
};

export const useInvalidateTeacherOverview = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: TEACHER_OVERVIEW_QUERY_KEY });
};
