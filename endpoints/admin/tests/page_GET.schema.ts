import { z } from "zod";
import {
  catalogueListBaseSchema,
  CatalogueListPage,
  fetchCatalogueListPage,
} from "../../../helpers/adminCatalogueList";

export const TEST_SERIES_SORT_COLUMNS = ["title", "students", "tests", "price", "createdAt"] as const;
export type TestSeriesSortColumn = (typeof TEST_SERIES_SORT_COLUMNS)[number];

export const schema = catalogueListBaseSchema.extend({
  status: z.enum(["published", "unpublished"]).optional(),
  /* Dashboard subsets, each mirroring a catalogue dashboard queue's SQL. */
  filter: z.enum(["no-tests", "empty-tests"]).optional(),
  sortBy: z.enum(TEST_SERIES_SORT_COLUMNS).optional(),
});

export type InputType = z.input<typeof schema>;

export type AdminTestSeriesPageItem = {
  id: number;
  title: string;
  slug: string;
  isPublished: boolean;
  createdAt: Date | null;
  studentsEnrolled: number;
  /* Stored counter that can drift; liveItemCount is counted live. */
  totalTests: number;
  totalQuestions: number;
  isFree: boolean | null;
  price: number;
  teacherName: string;
  totalOrders: number;
  /* Non-deleted tests in the series. */
  liveItemCount: number;
  /* Non-deleted tests in the series that have no questions. */
  emptyTestCount: number;
};

export type OutputType = CatalogueListPage<AdminTestSeriesPageItem, "published" | "unpublished"> & {
  /* Tests without questions across every matching series; set only under the empty-tests filter. */
  emptyTestTotal: number | null;
};

export const getAdminTestSeriesPage = (input: InputType, init?: RequestInit): Promise<OutputType> =>
  fetchCatalogueListPage<OutputType>("/_api/admin/tests/page", input, init);