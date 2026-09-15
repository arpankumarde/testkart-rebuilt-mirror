import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminCoursesList } from "../endpoints/admin/courses/list_GET.schema";
import { postDeactivateCourse } from "../endpoints/admin/courses/deactivate_POST.schema";

export const ADMIN_COURSES_QUERY_KEY = ["admin", "courses"] as const;

/**
 * A React Query hook to fetch the list of all courses for the admin panel.
 *
 * This hook calls the `/api/admin/courses/list` endpoint and provides data, loading, and error states.
 *
 * @returns The result of the `useQuery` hook, containing the list of all courses.
 */
export const useAdminCoursesQuery = () => {
  return useQuery({
    queryKey: ADMIN_COURSES_QUERY_KEY,
    queryFn: getAdminCoursesList,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * A React Query mutation hook for deactivating a course.
 *
 * This hook calls the `/api/admin/courses/deactivate` endpoint. On success, it
 * automatically invalidates the admin courses list query to refetch the updated data.
 *
 * @returns The result of the `useMutation` hook.
 */
export const useDeactivateCourseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postDeactivateCourse,
    onSuccess: () => {
      // Invalidate and refetch the courses list to reflect the change in status
      queryClient.invalidateQueries({ queryKey: ADMIN_COURSES_QUERY_KEY });
    },
  });
};