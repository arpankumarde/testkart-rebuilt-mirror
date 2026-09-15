import { useQuery } from "@tanstack/react-query";
import { getAdminStats } from "../endpoints/admin/stats_GET.schema";

export const ADMIN_STATS_QUERY_KEY = ["admin", "stats"] as const;

/** Platform statistics for the legacy dashboard page (this-month figures and all-time counts). */
export const useAdminStatsQuery = () => {
  return useQuery({
    queryKey: ADMIN_STATS_QUERY_KEY,
    queryFn: () => getAdminStats(),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });
};
