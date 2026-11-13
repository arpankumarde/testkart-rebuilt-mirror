import { useQuery } from "@tanstack/react-query";
import { getAdminDashboardTrends, type TrendPeriod } from "../endpoints/admin/dashboard/trends_GET.schema";

export const ADMIN_TRENDS_QUERY_KEY = ["admin", "dashboard-trends"] as const;

export const useAdminDashboardTrends = (period: TrendPeriod, enabled = true) =>
  useQuery({
    queryKey: [...ADMIN_TRENDS_QUERY_KEY, period],
    queryFn: () => getAdminDashboardTrends({ period }),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previous) => previous,
    enabled,
  });