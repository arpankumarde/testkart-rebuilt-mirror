import { useQuery } from "@tanstack/react-query";
import { getTeacherDashboardStats, OutputType } from "../endpoints/teacher/dashboard/stats_GET.schema";

export const TEACHER_DASHBOARD_STATS_QUERY_KEY = ["teacher", "dashboard", "stats"] as const;

/**
 * Hook to retrieve aggregated stats for the teacher dashboard.
 * Designed to provide counts, unique student lists, top content, and earning records all in a single query boundary.
 */
export const useTeacherDashboardStats = () => {
  return useQuery<OutputType, Error>({
    queryKey: TEACHER_DASHBOARD_STATS_QUERY_KEY,
    queryFn: async () => {
      return await getTeacherDashboardStats();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes of caching
    // See the matching comment in useTeacherProductsQuery — refetchOnMount
    // is disabled globally, so without this override this widget keeps
    // showing pre-mutation counts/top-items until a hard reload, even
    // though every entity mutation already invalidates this key.
    refetchOnMount: true,
  });
};