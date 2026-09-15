import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { postVerifyPendingPayments } from "../endpoints/payment/payu/verify-pending_POST.schema";

/**
 * Hook to manage smart pending payment verification polling.
 * 
 * Behavior:
 * - Starts polling after initial delay
 * - If no pending payments found, stops polling entirely
 * - Can be manually restarted (e.g., when user makes a purchase or navigates to payment pages)
 * 
 * @param isEnabled Whether the user is authenticated and initial delay has passed
 * @returns Object with verification data and methods to control polling
 */
export const usePendingPaymentVerification = (isEnabled: boolean) => {
  const [shouldPoll, setShouldPoll] = useState(true);
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);

  // Reset polling state when isEnabled changes (e.g., user logs in/out)
  useEffect(() => {
    if (isEnabled && !hasCheckedOnce) {
      setShouldPoll(true);
    }
  }, [isEnabled, hasCheckedOnce]);

  const { data: pendingVerification, isSuccess } = useQuery({
    queryKey: ["payment", "verify-pending"],
    queryFn: postVerifyPendingPayments,
    enabled: isEnabled && shouldPoll,
    refetchInterval: shouldPoll ? 60 * 60 * 1000 : false, // 60 minutes or disabled
    staleTime: 59 * 60 * 1000, // Slightly less than refetch interval
  });

  // After first successful check, determine if we should continue polling
  useEffect(() => {
    if (isSuccess && pendingVerification && isEnabled) {
      setHasCheckedOnce(true);
      
      const hasPendingOrders = pendingVerification.verifiedCount > 0 || 
                               pendingVerification.updatedOrders.length > 0;
      const hasPendingSubscriptions = pendingVerification.verifiedSubscriptionTransactionsCount > 0 ||
                                      pendingVerification.updatedSubscriptionTransactions.length > 0;
      
      // If no pending payments at all, stop polling
      if (!hasPendingOrders && !hasPendingSubscriptions) {
        console.log("PendingPaymentVerification: No pending payments found. Stopping polling.");
        setShouldPoll(false);
      } else {
        // Keep polling if there are pending payments
        const totalPending = (pendingVerification.verifiedCount - pendingVerification.updatedOrders.length) +
                            (pendingVerification.verifiedSubscriptionTransactionsCount - pendingVerification.updatedSubscriptionTransactions.length);
        console.log(`PendingPaymentVerification: ${totalPending} pending payments still waiting. Continuing polling.`);
      }
      
      // Log updates if any occurred
      if (pendingVerification.updatedOrders.length > 0) {
        console.log(`PendingPaymentVerification: Updated ${pendingVerification.updatedOrders.length} orders.`);
      }
      if (pendingVerification.updatedSubscriptionTransactions.length > 0) {
        console.log(`PendingPaymentVerification: Updated ${pendingVerification.updatedSubscriptionTransactions.length} subscription transactions.`);
      }
    }
  }, [isSuccess, pendingVerification, isEnabled]);

  /**
   * Manually restart polling.
   * Should be called when:
   * - User navigates to payment-related pages
   * - User initiates a new purchase
   * - User completes a payment flow
   */
  const restartPolling = () => {
    console.log("PendingPaymentVerification: Restarting polling manually.");
    setShouldPoll(true);
    setHasCheckedOnce(false);
  };

  return {
    data: pendingVerification,
    isPolling: shouldPoll,
    restartPolling,
  };
};