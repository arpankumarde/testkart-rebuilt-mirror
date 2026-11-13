import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAdminPriceHistory, type InputType as ListInput } from "../endpoints/admin/price-history/list_GET.schema";
import {
  getAdminProductPriceHistory,
  type InputType as ProductInput,
} from "../endpoints/admin/price-history/product_GET.schema";

export const ADMIN_PRICE_HISTORY_QUERY_KEY = ["admin", "price-history"] as const;

/* One page of the price history log; the previous page stays on screen while the next loads. */
export const useAdminPriceHistoryQuery = (input: ListInput) =>
  useQuery({
    queryKey: [...ADMIN_PRICE_HISTORY_QUERY_KEY, "list", input],
    queryFn: () => getAdminPriceHistory(input),
    placeholderData: keepPreviousData,
  });

/* Every recorded price change of one product, newest first. Idle until a product is chosen. */
export const useAdminProductPriceHistoryQuery = (input: ProductInput | null) =>
  useQuery({
    queryKey: [...ADMIN_PRICE_HISTORY_QUERY_KEY, "product", input],
    queryFn: () => getAdminProductPriceHistory(input as ProductInput),
    enabled: input !== null,
  });