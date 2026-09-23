import { useQuery } from "@tanstack/react-query";
import { getPublicPromoCodes } from "../endpoints/promo-codes/public_GET.schema";
import type { PromoItemType } from "./promoCodeEligibility";

export const PUBLIC_PROMO_CODES_QUERY_KEY = ["public", "promo-codes"];

/**
 * Coupons a teacher has made public for one product. The app-wide default never
 * refetches on mount, but a teacher can switch a coupon on, off or expire it at
 * any time, so this re-checks whenever a product page is opened after a minute.
 */
export const usePublicPromoCodesQuery = (
  itemType: PromoItemType,
  itemId: number | null | undefined
) => {
  return useQuery({
    queryKey: [...PUBLIC_PROMO_CODES_QUERY_KEY, itemType, itemId],
    queryFn: () => getPublicPromoCodes({ itemType, itemId: itemId as number }),
    enabled: typeof itemId === "number",
    staleTime: 60_000,
    refetchOnMount: true,
  });
};
