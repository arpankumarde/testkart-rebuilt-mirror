import { useQuery } from "@tanstack/react-query";
import { getStudentEnrolledLiveTests } from "../endpoints/student/enrolled-live-tests_GET.schema";

export const STUDENT_ENROLLED_LIVE_TESTS_QUERY_KEY = ["student", "enrolled-live-tests"] as const;

/**
 * A React Query hook to fetch all live tests the authenticated student is currently enrolled in.
 *
 * This hook leverages the `getStudentEnrolledLiveTests` endpoint and ensures data freshness by providing standard
 * loading, success, and error states out of the box.
 *
 * @example
 * const { data, isLoading, error } = useStudentEnrolledLiveTestsQuery();
 * const enrolledLiveTests = data?.enrolledLiveTests ?? [];
 */
export const useStudentEnrolledLiveTestsQuery = () => {
  return useQuery({
    queryKey: STUDENT_ENROLLED_LIVE_TESTS_QUERY_KEY,
    queryFn: () => getStudentEnrolledLiveTests(),
      });
};
