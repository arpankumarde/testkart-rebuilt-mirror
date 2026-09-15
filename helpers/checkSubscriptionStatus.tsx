import { useSubscriptionStatusQuery } from "./useTeacherSubscription";

/**
 * Checks if the teacher has an active subscription based on the fetched subscription data.
 * Returns:
 * - isLoading: whether the subscription data is still being fetched
 * - hasActiveSubscription: whether the teacher has an active subscription with a valid end date
 * - subscription: the raw subscription data (or null)
 */
export function useCheckSubscriptionStatus() {
  const { data: subscription, isFetching } = useSubscriptionStatusQuery();

  const isLoading = isFetching;

  let hasActiveSubscription = false;

  if (subscription && subscription.status === "active" && subscription.endDate) {
    hasActiveSubscription = new Date(subscription.endDate) > new Date();
  }

  return {
    isLoading,
    hasActiveSubscription,
    subscription,
  };
}