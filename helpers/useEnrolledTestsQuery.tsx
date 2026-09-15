import { useQuery } from "@tanstack/react-query";
import { getStudentEnrolledTests } from "../endpoints/student/enrolled-tests_GET.schema";

export const ENROLLED_TESTS_QUERY_KEY = ["enrolledTests"] as const;

/**
 * A React Query hook to fetch the mock tests the current student is enrolled in.
 *
 * This hook simplifies data fetching for enrolled tests by providing caching,
 * automatic refetching, and state management (loading, error, success).
 * It refetches data when the window regains focus to ensure the list is up-to-date.
 *
 * @example
 * const { data, isLoading, error } = useEnrolledTestsQuery();
 * const enrolledTests = data?.enrolledTests ?? [];
 *
 * if (isLoading) return <p>Loading your tests...</p>;
 * if (error) return <p>Could not load your tests.</p>;
 *
 * return (
 *   <ul>
 *     {enrolledTests.map(test => <li key={test.id}>{test.title}</li>)}
 *   </ul>
 * );
 */
export const useEnrolledTestsQuery = () => {
  return useQuery({
    queryKey: ENROLLED_TESTS_QUERY_KEY,
    queryFn: () => getStudentEnrolledTests(),
    
    staleTime: 5 * 60 * 1000,
  });
};