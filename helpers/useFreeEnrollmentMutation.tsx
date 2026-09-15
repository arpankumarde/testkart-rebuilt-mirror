import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { postTestsEnrollFree } from "../endpoints/tests/enroll-free_POST.schema";
import { CART_QUERY_KEY } from "./useCartQuery";
import { ENROLLED_TESTS_QUERY_KEY } from "./useEnrolledTestsQuery";
import { parseErrorMessage } from "./parseErrorMessage";

/**
 * A React Query mutation hook for enrolling the current user in a free mock test.
 * It handles the API call and provides user feedback via toast notifications.
 *
 * @returns A mutation object from React Query, including `mutate`, `mutateAsync`, and `isPending`.
 *
 * @example
 * const enrollMutation = useFreeEnrollmentMutation();
 *
 * const handleEnroll = (testId: number) => {
 *   enrollMutation.mutate({ mockTestId: testId });
 * };
 */
export const useFreeEnrollmentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postTestsEnrollFree,
    onSuccess: (data) => {
      toast.success(data.message || "Successfully enrolled in the test!");
      queryClient.invalidateQueries({ queryKey: ["student", "enrolled-tests"] });
      queryClient.invalidateQueries({ queryKey: ENROLLED_TESTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["tests", "public", "details"] });
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
    onError: (error) => {
      const errorMessage = parseErrorMessage(error);
      toast.error(errorMessage);
      console.error("Free enrollment mutation failed:", error);
    },
  });
};