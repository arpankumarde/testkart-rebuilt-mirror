import type { QueryClient } from "@tanstack/react-query";
import { TEACHER_BUNDLES_QUERY_KEY } from "./useTeacherBundlesQuery";
import { TEACHER_BUNDLE_DETAILS_QUERY_KEY } from "./useTeacherBundleDetailsQuery";
import { TEACHER_DASHBOARD_STATS_QUERY_KEY } from "./useTeacherDashboardStats";

// Called after an unpublish took published bundles down with the item, so the
// bundle list, an open bundle editor and the dashboard counts show the new state.
export const invalidateTeacherBundles = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: TEACHER_BUNDLES_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: TEACHER_BUNDLE_DETAILS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY });
};
