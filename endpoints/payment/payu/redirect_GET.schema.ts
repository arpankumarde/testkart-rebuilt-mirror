import { z } from "zod";

// This endpoint is initiated by a direct browser navigation (GET request),
// so it doesn't take a JSON body.
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

// This endpoint returns an HTML page with an auto-submitting form, not JSON.
// Therefore, there is no OutputType or a traditional client-side fetch helper.
// The function below simply provides the URL for the frontend to navigate to.

/**
 * Returns the URL for the PayU redirect endpoint.
 * The frontend should navigate to this URL (e.g., via window.location.href)
 * to initiate the payment process.
 * @param promoCodeId - Optional promo code ID to apply discount
 * @param useTcoins - Pay part of the order with Tcoins (never together with a promo code)
 * @returns The absolute URL path to the redirect endpoint.
 */
export const getPaymentPayuRedirectUrl = (promoCodeId?: number, useTcoins?: boolean): string => {
  const baseUrl = "/_api/payment/payu/redirect";
  if (promoCodeId) {
    return `${baseUrl}?promoCodeId=${promoCodeId}`;
  }
  if (useTcoins) {
    return `${baseUrl}?useTcoins=1`;
  }
  return baseUrl;
};