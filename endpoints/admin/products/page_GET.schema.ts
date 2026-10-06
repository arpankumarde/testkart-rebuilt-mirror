import { z } from "zod";
import { DigitalProductStatus } from "../../../helpers/schema";
import {
  catalogueListBaseSchema,
  CatalogueListPage,
  fetchCatalogueListPage,
} from "../../../helpers/adminCatalogueList";

export const NOTES_SORT_COLUMNS = ["title", "status", "category", "price", "sales", "createdAt"] as const;
export type NotesSortColumn = (typeof NOTES_SORT_COLUMNS)[number];

export const schema = catalogueListBaseSchema.extend({
  status: z.enum(["published", "draft", "archived"]).optional(),
  /* Dashboard subset: notes a student would get no file from - see digitalProductRules. */
  filter: z.enum(["no-file"]).optional(),
  sortBy: z.enum(NOTES_SORT_COLUMNS).optional(),
});

export type InputType = z.input<typeof schema>;

export type AdminNotesPageItem = {
  id: number;
  title: string;
  slug: string;
  status: DigitalProductStatus | null;
  createdAt: Date | null;
  price: number;
  totalPurchases: number | null;
  category: string | null;
  teacherName: string;
  filesCount: number;
  totalPages: number;
};

export type OutputType = CatalogueListPage<AdminNotesPageItem, DigitalProductStatus>;

export const getAdminNotesPage = (input: InputType, init?: RequestInit): Promise<OutputType> =>
  fetchCatalogueListPage<OutputType>("/_api/admin/products/page", input, init);