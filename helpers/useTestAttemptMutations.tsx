import { useQuery, useMutation } from "@tanstack/react-query";
import { getStudentTestItemQuestions } from "../endpoints/student/test-item/questions_GET.schema";
import { postStudentTestItemStartAttempt } from "../endpoints/student/test-item/start-attempt_POST.schema";
import { postStudentTestItemSubmitAttempt } from "../endpoints/student/test-item/submit-attempt_POST.schema";

/**
 * Creates a query key for fetching questions of a specific test item.
 * @param testItemId The ID of the test item.
 * @param attemptId The ID of the attempt (for cache invalidation).
 */
export const testQuestionsQueryKey = (testItemId: number, attemptId: number | null) =>
  ["testQuestions", testItemId, attemptId] as const;

/**
 * A React Query hook to fetch the questions for a specific test item.
 * This hook is enabled only when a valid `testItemId` is provided.
 *
 * @param testItemId The ID of the test item.
 * @param attemptId The ID of the attempt (for cache invalidation).
 * @returns A query object containing the questions data, loading state, and error state.
 */
export const useTestQuestionsQuery = (testItemId: number | undefined, attemptId: number | null = null) => {
  const isEnabled = !!testItemId && testItemId > 0;
  
  console.log('[useTestQuestionsQuery] Hook called:', {
    testItemId,
    attemptId,
    isEnabled,
    queryKey: testItemId ? testQuestionsQueryKey(testItemId, attemptId) : 'undefined',
  });
  
  return useQuery({
    queryKey: testQuestionsQueryKey(testItemId!, attemptId),
    queryFn: () => {
      console.log('[useTestQuestionsQuery] queryFn executing for testItemId:', testItemId);
      return getStudentTestItemQuestions({ testItemId: testItemId! });
    },
    enabled: isEnabled,
  });
};

/**
 * A React Query mutation hook to start a new test attempt.
 * This is a pure mutation - the component should handle all side effects.
 *
 * @param testItemId The ID of the test item being attempted.
 * @returns A mutation object to trigger the start of a test attempt.
 */
export const useStartAttemptMutation = (testItemId: number) => {
  return useMutation({
    mutationKey: ['startAttempt', testItemId],
    mutationFn: postStudentTestItemStartAttempt,
  });
};

/**
 * A React Query mutation hook to submit a test attempt.
 * This is a pure mutation - the component should handle all side effects.
 *
 * @param attemptId The ID of the attempt being submitted.
 * @returns A mutation object to trigger the submission of a test attempt.
 */
export const useSubmitAttemptMutation = (attemptId: number) => {
  return useMutation({
    mutationKey: ['submitAttempt', attemptId],
    mutationFn: postStudentTestItemSubmitAttempt,
  });
};