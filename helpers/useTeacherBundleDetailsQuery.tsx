import { useQuery } from "@tanstack/react-query";
import { getTeacherBundleDetails } from "../endpoints/teacher/bundles/details_GET.schema";

export const TEACHER_BUNDLE_DETAILS_QUERY_KEY = ["teacher", "bundle", "details"] as const;

export const useTeacherBundleDetailsQuery = (bundleId: number | undefined) => {
  return useQuery({
    queryKey: [...TEACHER_BUNDLE_DETAILS_QUERY_KEY, bundleId],
    queryFn: async () => {
      if (!bundleId) {
        throw new Error("bundleId is required to fetch bundle details.");
      }
      return getTeacherBundleDetails({ bundleId });
    },
    enabled: !!bundleId,
    staleTime: 5 * 60 * 1000,
    // refetchOnMount is off app-wide, which would also skip invalidations on remount.
    refetchOnMount: true,
  });
};