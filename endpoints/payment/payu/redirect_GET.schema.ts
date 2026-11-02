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
 * @param promoCodeId - The coupon the student chose, added on top of the teacher offers
 * @param useTcoins - Pay part of the order with Tcoins (never together with a coupon)
 * @param autoPromoCodeIds - The automatic teacher offers the cart showed; checkout stops if one
 *   has ended or changed. Not sent with Tcoins, which replace the offers.
 * @returns The absolute URL path to the redirect endpoint.
 */
export const getPaymentPayuRedirectUrl = (promoCodeId?: number, useTcoins?: boolean, autoPromoCodeIds?: number[]): string => {
  const params = new URLSearchParams();
  if (useTcoins) {
    params.set("useTcoins", "1");
  } else {
    if (promoCodeId) params.set("promoCodeId", String(promoCodeId));
    if (autoPromoCodeIds && autoPromoCodeIds.length > 0) params.set("autoPromoCodeIds", autoPromoCodeIds.join(","));
  }
  const query = params.toString();
  return query ? `/_api/payment/payu/redirect?${query}` : "/_api/payment/payu/redirect";
};