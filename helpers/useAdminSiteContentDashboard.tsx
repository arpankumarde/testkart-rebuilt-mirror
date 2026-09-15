import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminSiteContentDashboard,
  SiteRange,
} from "../endpoints/admin/content/dashboard_GET.schema";

export const ADMIN_SITE_CONTENT_QUERY_KEY = ["admin", "site-content-dashboard"] as const;

const STALE_TIME = 5 * 60 * 1000;

/**
 * One request feeds the whole content dashboard. Editorial work moves slowly,
 * so the default window is 30 days rather than the main overview's 7.
 */
export const useAdminSiteContentDashboard = (range: SiteRange = "30d", enabled = true) => {
  return useQuery({
    queryKey: [...ADMIN_SITE_CONTENT_QUERY_KEY, range],
    queryFn: () => getAdminSiteContentDashboard({ range }),
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous,
    enabled,
  });
};

export const useInvalidateAdminSiteContent = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ADMIN_SITE_CONTENT_QUERY_KEY });
};
