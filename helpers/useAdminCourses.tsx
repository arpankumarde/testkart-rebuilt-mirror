import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { getAdminCoursesPage, InputType as CoursesPageInput } from "../endpoints/admin/courses/page_GET.schema";
import { postDeactivateCourse } from "../endpoints/admin/courses/deactivate_POST.schema";

export const ADMIN_COURSES_QUERY_KEY = ["admin", "courses"] as const;

/* One page of the admin courses list; the previous page stays on screen while the next loads. */
export const useAdminCoursesPageQuery = (input: CoursesPageInput) => {
  return useQuery({
    queryKey: [...ADMIN_COURSES_QUERY_KEY, "page", input],
    queryFn: () => getAdminCoursesPage(input),
    placeholderData: keepPreviousData,
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