import { z } from "zod";
import { fetchCatalogueListPage } from "../../../helpers/adminCatalogueList";
import {
  PRICE_HISTORY_PRODUCT_TYPES,
  PRICE_MOVEMENTS,
  type PriceChangeSource,
  type PriceHistoryProductType,
} from "../../../helpers/productPriceHistory";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

export const schema = z.object({
  page: z.coerce.number().int().positive().default(1),
  /* Matches the product title, or the teacher's name or email. */
  search: z.string().trim().max(200).optional(),
  productType: z.enum(PRICE_HISTORY_PRODUCT_TYPES).optional(),
  teacherId: z.coerce.number().int().positive().optional(),
  movement: z.enum(PRICE_MOVEMENTS).optional(),
  /* IST calendar days, both inclusive. */
  from: isoDay.optional(),
  to: isoDay.optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

export type InputType = z.input<typeof schema>;

export type PriceHistoryEntry = {
  id: number;
  productType: PriceHistoryProductType;
  /* Integer ids for most types, a uuid for live courses. */
  productId: string;
  productTitle: string;
  teacherId: number | null;
  teacherName: string | null;
  previousPrice: number;
  newPrice: number;
  previousListPrice: number | null;
  newListPrice: number | null;
  changeSource: PriceChangeSource;
  changedByUserId: number | null;
  changedByAdminId: number | null;
  changedByName: string | null;
  changedAt: Date;
};

export type OutputType = {
  items: PriceHistoryEntry[];
  total: number;
  page: number;
  totalPages: number;
  /* The product types this admin may see, for the type filter. */
  productTypes: PriceHistoryProductType[];
  /* Teachers with at least one recorded change in those types, for the teacher filter. */
  teachers: { id: number; name: string; count: number }[];
};

export const getAdminPriceHistory = (input: InputType, init?: RequestInit): Promise<OutputType> =>
  fetchCatalogueListPage<OutputType>("/_api/admin/price-history/list", input, init);