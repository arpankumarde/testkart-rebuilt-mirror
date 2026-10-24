import { useQuery } from "@tanstack/react-query";
import { getAdminPromoAnalytics, PromoAnalyticsRange } from "../endpoints/admin/orders/promo-analytics_GET.schema";

export const ADMIN_PROMO_ANALYTICS_QUERY_KEY = ["admin", "promoAnalytics"] as const;

export const useAdminPromoAnalyticsQuery = (range: PromoAnalyticsRange) =>
  useQuery({
    queryKey: [...ADMIN_PROMO_ANALYTICS_QUERY_KEY, range],
    queryFn: () => getAdminPromoAnalytics({ range }),
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
  });