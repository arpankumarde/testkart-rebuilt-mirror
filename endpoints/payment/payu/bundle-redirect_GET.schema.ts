import { z } from "zod";

// This endpoint is initiated by a direct browser navigation (GET request),
// so it doesn't take a JSON body.
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

// This endpoint returns an HTML page with an auto-submitting form, not JSON.
// Therefore, there is no OutputType or a traditional client-side fetch helper.
// The function below simply provides the URL for the frontend to navigate to.

/**
 * Returns the URL for the PayU bundle redirect endpoint.
 * The frontend should navigate to this URL (e.g., via window.location.href)
 * to initiate the payment process for a bundle.
 * @param bundleId - ID of the bundle to purchase
 * @param promoCodeId - Optional ID of the promo code to apply
 * @returns The absolute URL path to the redirect endpoint.
 */
export const getBundleRedirectUrl = (bundleId: number, promoCodeId?: number | null): string => {
  const baseUrl = "/_api/payment/payu/bundle-redirect";
  let url = `${baseUrl}?bundleId=${bundleId}`;
  if (promoCodeId) {
    url += `&promoCodeId=${promoCodeId}`;
  }
  return url;
};