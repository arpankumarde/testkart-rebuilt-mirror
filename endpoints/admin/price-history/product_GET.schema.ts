import { z } from "zod";
import { fetchCatalogueListPage } from "../../../helpers/adminCatalogueList";
import { PRICE_HISTORY_PRODUCT_TYPES } from "../../../helpers/productPriceHistory";
import type { PriceHistoryEntry } from "./list_GET.schema";

export const schema = z.object({
  productType: z.enum(PRICE_HISTORY_PRODUCT_TYPES),
  /* Integer ids for most types, a uuid for live courses. */
  productId: z.string().trim().min(1).max(64),
});

export type InputType = z.input<typeof schema>;

export type PriceHistoryProductSnapshot = {
  /* False once the product row is gone; its history is kept. */
  exists: boolean;
  title: string | null;
  status: string | null;
  teacherId: number | null;
  teacherName: string | null;
  currentPrice: number | null;
  currentListPrice: number | null;
};

export type OutputType = {
  product: PriceHistoryProductSnapshot;
  /* Newest first. */
  entries: PriceHistoryEntry[];
};

export const getAdminProductPriceHistory = (input: InputType, init?: RequestInit): Promise<OutputType> =>
  fetchCatalogueListPage<OutputType>("/_api/admin/price-history/product", input, init);