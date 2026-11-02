import { useMutation } from "@tanstack/react-query";
import { getPaymentPayuRedirectUrl } from "../endpoints/payment/payu/redirect_GET.schema";
import { toast } from "sonner";

const PAYMENT_QUERY_KEY = ["payment", "initiate"] as const;

/**
 * A React Query mutation hook to initiate a payment with PayU.
 * It navigates the user directly to the redirect endpoint which handles
 * the payment initiation and form submission server-side.
 *
 * @param promoCodeId - The coupon the student chose, added on top of the teacher offers
 * @param useTcoins - Pay part of the order with Tcoins
 * @param autoPromoCodeIds - The automatic teacher offers the cart showed
 */
export const useInitiatePaymentMutation = () => {
  return useMutation<void, Error, { promoCodeId?: number; useTcoins?: boolean; autoPromoCodeIds?: number[] }>({
    mutationKey: PAYMENT_QUERY_KEY,
    mutationFn: async ({ promoCodeId, useTcoins, autoPromoCodeIds }) => {
      // The endpoint starts the payment server-side and redirects to PayU.
      toast.loading("Redirecting to payment gateway...");
      window.location.href = getPaymentPayuRedirectUrl(promoCodeId, useTcoins, autoPromoCodeIds);

      // Never resolves: the page is navigating away, so no onSuccess/onError should fire.
      return new Promise<void>(() => {});
    },
  });
};
