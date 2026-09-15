import { useQuery } from "@tanstack/react-query";
import { getAdminDashboardTrends } from "../endpoints/admin/dashboard/trends_GET.schema";

export const ADMIN_DASHBOARD_TRENDS_QUERY_KEY = ["admin", "dashboard-trends"] as const;

/** Signup and revenue trends by day, week or month for the legacy dashboard charts. */
export const useAdminDashboardTrendsQuery = (period: "daily" | "weekly" | "monthly") => {
  return useQuery({
    queryKey: [...ADMIN_DASHBOARD_TRENDS_QUERY_KEY, period],
    queryFn: () => getAdminDashboardTrends({ period }),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    placeholderData: (previous) => previous,
  });
};
