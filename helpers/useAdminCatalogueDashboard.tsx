import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminCatalogueDashboard,
  ContentRange,
} from "../endpoints/admin/catalogue/dashboard_GET.schema";

export const ADMIN_CATALOGUE_DASHBOARD_QUERY_KEY = ["admin", "catalogue-dashboard"] as const;

const STALE_TIME = 5 * 60 * 1000;

/**
 * One request feeds the whole content dashboard. It is separate from the main
 * overview because content moves on a slower clock and defaults to 30 days.
 */
export const useAdminCatalogueDashboard = (range: ContentRange = "30d", enabled = true) => {
  return useQuery({
    queryKey: [...ADMIN_CATALOGUE_DASHBOARD_QUERY_KEY, range],
    queryFn: () => getAdminCatalogueDashboard({ range }),
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous,
    enabled,
  });
};

export const useInvalidateAdminContentDashboard = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ADMIN_CATALOGUE_DASHBOARD_QUERY_KEY });
};
