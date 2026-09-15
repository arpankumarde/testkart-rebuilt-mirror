import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getTeacherSubscriptionMandateStatus } from "../endpoints/teacher/subscription/mandate/status_GET.schema";
import {
  postTeacherSubscriptionMandateCancel,
  InputType as CancelMandateInput,
} from "../endpoints/teacher/subscription/mandate/cancel_POST.schema";
import {
  postPaymentPayuRecurringChargeMandate,
  InputType as ChargeMandateInput,
} from "../endpoints/payment/payu/recurring/charge-mandate_POST.schema";
import { subscriptionQueryKeys } from "./useTeacherSubscription";

export const mandateQueryKeys = {
  all: ["teacher", "subscription", "mandate"] as const,
  status: () => [...mandateQueryKeys.all, "status"] as const,
};

/**
 * Fetches the current status of the teacher's recurring payment mandate.
 */
export const useMandateStatusQuery = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: mandateQueryKeys.status(),
    queryFn: () => getTeacherSubscriptionMandateStatus(),
    enabled: options?.enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes - mandate status changes infrequently
  });
};

/**
 * A mutation to cancel an active recurring payment mandate.
 * This will stop auto-renewal for the subscription.
 */
export const useCancelMandateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CancelMandateInput) =>
      postTeacherSubscriptionMandateCancel(data),
    onSuccess: () => {
      console.log("Mandate cancelled successfully. Invalidating queries.");
      // Invalidate both mandate and overall subscription status to reflect the change
      queryClient.invalidateQueries({ queryKey: mandateQueryKeys.status() });
      queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.status(),
      });
    },
    onError: (error) => {
      console.error("Failed to cancel mandate:", error);
    },
  });
};

/**
 * A mutation to manually trigger a recurring charge against an active mandate.
 * This is used for subscription renewals.
 */
export const useChargeMandateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ChargeMandateInput) =>
      postPaymentPayuRecurringChargeMandate(data),
    onSuccess: () => {
      console.log(
        "Mandate charged successfully. Invalidating subscription, mandate, and history queries."
      );
      // After a successful charge, the subscription dates, mandate status, and transaction history are all updated.
      queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.status(),
      });
      queryClient.invalidateQueries({ queryKey: mandateQueryKeys.status() });
      queryClient.invalidateQueries({
        queryKey: [...subscriptionQueryKeys.all, "history"],
      });
    },
    onError: (error) => {
      console.error("Failed to charge mandate:", error);
    },
  });
};

/**
 * A hook to automatically check and trigger subscription renewal if due.
 * This should be called on app load for authenticated teachers (e.g., in a layout component).
 * @param {number | undefined} subscriptionId - The ID of the active subscription.
 * @param {boolean} [enabled=true] - Whether the check should run (default: true).
 */
export const useAutoRenewalCheck = (
  subscriptionId: number | undefined,
  enabled: boolean = true
) => {
  const {
    data: mandateStatus,
    isFetching: isChecking,
    isSuccess,
  } = useMandateStatusQuery({ enabled });
  const { mutate: triggerRenewal, isPending: isRenewing } =
    useChargeMandateMutation();
  const [needsRenewal, setNeedsRenewal] = useState(false);

  useEffect(() => {
    if (
      isSuccess &&
      mandateStatus &&
      subscriptionId &&
      mandateStatus.mandateStatus === "active" &&
      mandateStatus.nextChargeDate &&
      new Date(mandateStatus.nextChargeDate) <= new Date()
    ) {
      console.log(
        `Auto-renewal check: Subscription ${subscriptionId} is due for renewal.`
      );
      setNeedsRenewal(true);
      triggerRenewal({ subscriptionId });
    } else if (isSuccess) {
      setNeedsRenewal(false);
    }
  }, [isSuccess, mandateStatus, subscriptionId, triggerRenewal]);

  return {
    isChecking: isChecking || isRenewing,
    needsRenewal,
    triggerRenewal: (subId: number) => triggerRenewal({ subscriptionId: subId }),
  };
};