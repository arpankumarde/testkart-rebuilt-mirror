import { z } from "zod";
import superjson from "superjson";
import { AnalyticsRangeValues, AnalyticsRange } from "../../../helpers/teacherAnalyticsTime";
import { TeacherMixKind, TeacherMixKindValues } from "../dashboard/overview_GET.schema";

export const AnalyticsProductSortValues = [
  "net",
  "gross",
  "visitors",
  "conversion",
  "paidUnits",
  "freeUnits",
  "refunds",
  "enrolments",
  "rating",
  "completion",
  "title",
] as const;
export type AnalyticsProductSort = (typeof AnalyticsProductSortValues)[number];

export const AnalyticsProductKindValues = ["all", ...TeacherMixKindValues] as const;
export type AnalyticsProductKind = (typeof AnalyticsProductKindValues)[number];

export const ANALYTICS_PRODUCTS_PAGE_SIZE = 25;

export const schema = z.object({
  range: z.enum(AnalyticsRangeValues).default("30d"),
  kind: z.enum(AnalyticsProductKindValues).default("all"),
  sort: z.enum(AnalyticsProductSortValues).default("net"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export type InputType = z.infer<typeof schema>;

/**
 * One sellable item. Money, units, refunds and enrolments cover the chosen
 * range; rating and completion are all time, since a handful of reviews or
 * attempts in one week says little. A live test is its own row even though
 * its sales run through the mock test behind it.
 */
export type AnalyticsProductRow = {
  kind: TeacherMixKind;
  id: number;
  title: string;
  /** Published (or, for a live test, active) right now. */
  live: boolean;
  /** Distinct browsers that opened the item's page in the range, and their page views. */
  visitors: number;
  views: number;
  /** The item's older all-time page-load counter; null for bundles, which never had one. */
  lifetimeViews: number | null;
  /** Bought or claimed units per 100 visitors in the range; null with no tracked visitors. */
  conversion: number | null;
  paidUnits: number;
  freeUnits: number;
  gross: number;
  net: number;
  refunds: number;
  /** Null for study notes, which have no enrolment record apart from the purchase. */
  enrolments: number | null;
  rating: number | null;
  ratingCount: number;
  /**
   * Tests and live tests: percent of started papers that were finished, one
   * per student and paper. Courses: average progress. Null otherwise or when
   * nothing has been started.
   */
  completion: number | null;
};

export type AnalyticsTopProduct = Pick<AnalyticsProductRow, "kind" | "id" | "title" | "net" | "gross">;

export type OutputType = {
  range: AnalyticsRange;
  generatedAt: Date;
  kind: AnalyticsProductKind;
  sort: AnalyticsProductSort;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
  total: number;
  kindCounts: Record<AnalyticsProductKind, number>;
  rows: AnalyticsProductRow[];
  /** Top ten by net across every kind, for the chart above the table. */
  top: AnalyticsTopProduct[];
};

export const getTeacherAnalyticsProducts = async (query: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({
    range: query.range,
    kind: query.kind,
    sort: query.sort,
    dir: query.dir,
    page: String(query.page),
  });
  const result = await fetch(`/_api/teacher/analytics/products?${params.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};