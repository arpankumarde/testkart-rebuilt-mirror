import { useQuery } from '@tanstack/react-query';
import { getTestItemInstructions } from '../endpoints/student/test-item/instructions_GET.schema';

/**
 * A React Query hook to fetch mock test item instruction details.
 * Intended for the student-facing instructions page before they start a test.
 */
export function useTestItemInstructions(testItemId: number | null | undefined) {
  return useQuery({
    queryKey: ['test-item-instructions', testItemId],
    queryFn: () => getTestItemInstructions({ testItemId: testItemId! }),
    enabled: !!testItemId && testItemId > 0,
    retry: 1,
  });
}