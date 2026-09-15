import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminDashboardOverview,
  OverviewRange,
} from "../endpoints/admin/dashboard/overview_GET.schema";

export const ADMIN_OVERVIEW_QUERY_KEY = ["admin", "dashboard-overview"] as const;

const STALE_TIME = 5 * 60 * 1000;

/**
 * One request feeds the whole dashboard and the sidebar's pending counts. The
 * layout always reads the default 7d window, which is also the dashboard's
 * default, so a normal visit costs a single backend call.
 */
export const useAdminDashboardOverview = (range: OverviewRange = "7d", enabled = true) => {
  return useQuery({
    queryKey: [...ADMIN_OVERVIEW_QUERY_KEY, range],
    queryFn: () => getAdminDashboardOverview({ range }),
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous,
    enabled,
  });
};

export const useInvalidateAdminOverview = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ADMIN_OVERVIEW_QUERY_KEY });
};
