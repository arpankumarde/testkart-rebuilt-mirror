import { useEffect, useState } from "react";
import { useAuth } from "../helpers/useAuth";
import { useAutoRenewalCheck } from "../helpers/useRecurringPayment";
import { useQuery } from "@tanstack/react-query";
import { getTeacherSubscriptionStatus } from "../endpoints/teacher/subscription/status_GET.schema";
import { subscriptionQueryKeys } from "../helpers/useTeacherSubscription";
import { usePendingPaymentVerification } from "../helpers/usePendingPaymentVerification";

/**
 * A non-visual component that silently runs background checks for authenticated users.
 * This component should be placed in a global context provider.
 *
 * It handles two main tasks:
 * 1. For teachers: Checks for and triggers automatic subscription renewals.
 * 2. For students: Periodically verifies the status of any pending payments.
 */
export const AutoRenewalChecker = () => {
  const { authState } = useAuth();
  const isTeacher = authState.type === "authenticated" && authState.user.role === "teacher";
  const isStudent = authState.type === "authenticated" && authState.user.role === "student";
  const isAuthenticatedUser = authState.type === "authenticated";

  const [initialDelayPassed, setInitialDelayPassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialDelayPassed(true);
    }, 30000); // 30 seconds delay

    return () => clearTimeout(timer);
  }, []);

  // --- Subscription Auto-Renewal Logic for Teachers ---
  const { data: subscriptionStatus, isSuccess } = useQuery({
    queryKey: subscriptionQueryKeys.status(),
    queryFn: getTeacherSubscriptionStatus,
    enabled: isTeacher && initialDelayPassed,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  const subscriptionId =
    isSuccess && subscriptionStatus?.status === "active"
      ? subscriptionStatus.id
      : undefined;

  const { isChecking, needsRenewal } = useAutoRenewalCheck(
    subscriptionId,
    isTeacher && initialDelayPassed && !!subscriptionId
  );

  useEffect(() => {
    if (isTeacher && initialDelayPassed) {
      if (isChecking) {
        console.log("AutoRenewalChecker: Checking for subscription renewal...");
      }
      if (needsRenewal) {
        console.log(`AutoRenewalChecker: Renewal needed for subscription ID: ${subscriptionId}. Processing...`);
      }
    }
  }, [isChecking, needsRenewal, isTeacher, subscriptionId]);


  // --- Pending Payment Verification Logic for Students & Teachers ---
  // Smart polling that:
  // - Checks for pending payments after initial delay
  // - Automatically stops polling if no pending payments are found
  // - Can be restarted from payment-related pages via the exported hook
  const { isPolling } = usePendingPaymentVerification(
    isAuthenticatedUser && initialDelayPassed
  );

  useEffect(() => {
    if (isAuthenticatedUser && initialDelayPassed) {
      console.log(`AutoRenewalChecker: Pending payment verification ${isPolling ? "active" : "paused"}.`);
    }
  }, [isPolling, isAuthenticatedUser, initialDelayPassed]);


  // This component does not render any UI
  return null;
};