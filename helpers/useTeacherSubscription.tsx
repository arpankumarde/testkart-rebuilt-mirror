import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeacherSubscriptionStatus } from "../endpoints/teacher/subscription/status_GET.schema";
import { getTeacherSubscriptionPlans } from "../endpoints/teacher/subscription/plans_GET.schema";
import { getTeacherSubscriptionHistory } from "../endpoints/teacher/subscription/history_GET.schema";
import { postTeacherSubscriptionCancel } from "../endpoints/teacher/subscription/cancel_POST.schema";
import { postTeacherSubscriptionSubscribe } from "../endpoints/teacher/subscription/subscribe_POST.schema";
import { toast } from "sonner";
import { parseErrorMessage } from "./parseErrorMessage";

export const subscriptionQueryKeys = {
  all: ["teacher", "subscription"] as const,
  status: () => [...subscriptionQueryKeys.all, "status"] as const,
  plans: () => [...subscriptionQueryKeys.all, "plans"] as const,
  history: () => [...subscriptionQueryKeys.all, "history"] as const,
};

/**
 * Fetches the current subscription status for the authenticated teacher.
 */
export const useSubscriptionStatusQuery = () => {
  return useQuery({
    queryKey: subscriptionQueryKeys.status(),
    queryFn: getTeacherSubscriptionStatus,
    staleTime: 15 * 60 * 1000,
  });
};

/**
 * Fetches all available subscription plans.
 */
export const useSubscriptionPlansQuery = () => {
  return useQuery({
    queryKey: subscriptionQueryKeys.plans(),
    queryFn: getTeacherSubscriptionPlans,
    staleTime: 30 * 60 * 1000,
  });
};

/**
 * Fetches the subscription transaction history for the authenticated teacher.
 */
export const useSubscriptionHistoryQuery = (page: number, limit: number) => {
  return useQuery({
    queryKey: [...subscriptionQueryKeys.history(), page, limit],
    queryFn: () => getTeacherSubscriptionHistory({ page, limit }),
    staleTime: 15 * 60 * 1000,
  });
};

/**
 * Cancels the active subscription for the authenticated teacher.
 */
export const useCancelSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => postTeacherSubscriptionCancel({}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.status(),
      });
      queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.history(),
      });
      toast.success("Subscription cancelled successfully", {
        description: "Your subscription will remain active until the end of the current billing period.",
      });
    },
    onError: (error) => {
      console.error("Error cancelling subscription:", error);
      toast.error("Failed to cancel subscription", {
        description: parseErrorMessage(error) ||  "An unknown error occurred",
      });
    },
  });
};

/**
 * Subscribes to a plan (used for free plans or plan switches).
 */
export const useSubscribeToPlanMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { planId: number; paymentMethod?: string }) =>
      postTeacherSubscriptionSubscribe(params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.status(),
      });
      queryClient.invalidateQueries({
        queryKey: subscriptionQueryKeys.history(),
      });
    },
    onError: (error) => {
      console.error("Error subscribing to plan:", error);
      toast.error("Failed to subscribe to plan", {
        description: parseErrorMessage(error) ||  "An unknown error occurred",
      });
    },
  });
};