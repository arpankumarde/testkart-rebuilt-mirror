import { useMutation } from "@tanstack/react-query";
import { getPaymentPayuRedirectUrl } from "../endpoints/payment/payu/redirect_GET.schema";
import { toast } from "sonner";

const PAYMENT_QUERY_KEY = ["payment", "initiate"] as const;

/**
 * A React Query mutation hook to initiate a payment with PayU.
 * It navigates the user directly to the redirect endpoint which handles
 * the payment initiation and form submission server-side.
 * 
 * @param promoCodeId - Optional promo code ID to apply discount during payment
 */
export const useInitiatePaymentMutation = () => {
  return useMutation<void, Error, { promoCodeId?: number }>({
    mutationKey: PAYMENT_QUERY_KEY,
    mutationFn: async ({ promoCodeId }) => {
      // Simply navigate to the redirect endpoint
      // The endpoint will handle payment initiation and redirect to PayU
      toast.loading("Redirecting to payment gateway...");
      window.location.href = getPaymentPayuRedirectUrl(promoCodeId);
      
      // Return a promise that never resolves since we're navigating away
      // This prevents any onSuccess/onError callbacks from firing
      return new Promise<void>(() => {});
    },
  });
};