import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  getTeacherBundlesList,
  InputType,
} from "../endpoints/teacher/bundles/list_GET.schema";

export const TEACHER_BUNDLES_QUERY_KEY = ["teacher", "bundles"];

/**
 * A React Query hook to fetch the list of course bundles for the authenticated teacher.
 * Supports pagination and filtering by status.
 *
 * @param filters - Optional filters for the query, including page, limit, and status ('published' or 'draft').
 * @returns The React Query result object, containing the list of bundles and total count.
 */
export const useTeacherBundlesQuery = (filters: InputType) => {
  return useQuery({
    queryKey: [...TEACHER_BUNDLES_QUERY_KEY, filters],
    queryFn: () => getTeacherBundlesList(filters),
    placeholderData: keepPreviousData,
    staleTime: 15 * 60 * 1000,
    // refetchOnMount is off app-wide, so an invalidation fired while this list
    // was unmounted would otherwise wait for a hard reload.
    refetchOnMount: true,
  });
};