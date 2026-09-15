import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";
import { postLiveTestsEnroll } from "../endpoints/live-tests/enroll_POST.schema";
import { LIVE_TESTS_QUERY_KEY } from "./useLiveTestsQuery";
import { LIVE_TEST_DETAILS_QUERY_KEY_PREFIX } from "./useLiveTestDetailsQuery";
import { useAuth } from "./useAuth";

interface EnrollmentInput {
  liveTestId: number;
  orderId?: number;
}

export const useLiveTestEnrollment = () => {
  const queryClient = useQueryClient();
  const { authState } = useAuth();

  return useMutation({
    mutationFn: (data: EnrollmentInput) => postLiveTestsEnroll({ 
      liveTestId: data.liveTestId,
      paymentOrderId: data.orderId 
    }),
    onSuccess: (data, variables) => {
      toast.success("Successfully enrolled in the live test!");
      // Invalidate the main list of live tests to update enrollment status there
      queryClient.invalidateQueries({ queryKey: LIVE_TESTS_QUERY_KEY });
      // Invalidate the specific test details to update the 'isEnrolled' and 'canEnroll' flags
      // Using prefix matching to invalidate all query keys for this test regardless of user ID
      queryClient.invalidateQueries({
        queryKey: [LIVE_TEST_DETAILS_QUERY_KEY_PREFIX, variables.liveTestId],
        exact: false,
      });
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(`Enrollment failed: ${parseErrorMessage(error)}`);
      } else {
        toast.error("An unknown error occurred during enrollment.");
      }
      console.error("Live test enrollment error:", error);
    },
  });
};