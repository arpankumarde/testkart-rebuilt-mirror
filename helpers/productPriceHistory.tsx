import type { AdminModule } from "./adminPermissions";

/*
 * Teacher product price history, shared by the admin endpoints and pages.
 * Rows are written by database triggers (tk_record_product_price_change) on every
 * product table, so any path that changes a price is recorded; see
 * helpers/productPriceHistoryServer for how an endpoint names who made the change.
 *
 * previousPrice/newPrice are what a student pays (a valid discount, else the list
 * price). previousListPrice/newListPrice are the undiscounted price: the `price`
 * column for notes, courses, tests and live tests, `original_price` for live
 * courses, and none for bundles, whose original price is derived from their items.
 */

export const PRICE_HISTORY_PRODUCT_TYPES = [
  "mock_test",
  "course",
  "digital_product",
  "course_bundle",
  "live_test",
  "live_course",
] as const;

export type PriceHistoryProductType = (typeof PRICE_HISTORY_PRODUCT_TYPES)[number];

export const PRICE_HISTORY_TYPE_LABELS: Record<PriceHistoryProductType, string> = {
  mock_test: "Test series",
  course: "Course",
  digital_product: "Study notes",
  course_bundle: "Bundle",
  live_test: "Live test",
  live_course: "Live course",
};

/* The admin section that owns each product type; holding it unlocks that type's price history. */
export const PRICE_HISTORY_TYPE_MODULES: Record<PriceHistoryProductType, AdminModule> = {
  mock_test: "test_series",
  course: "courses",
  digital_product: "notes",
  course_bundle: "bundles",
  live_test: "live_tests",
  live_course: "live_courses",
};

export const PRICE_HISTORY_MODULES: AdminModule[] = PRICE_HISTORY_PRODUCT_TYPES.map(
  (type) => PRICE_HISTORY_TYPE_MODULES[type]
);

export const permittedPriceHistoryTypes = (
  permissions: readonly string[] | null | undefined
): PriceHistoryProductType[] =>
  PRICE_HISTORY_PRODUCT_TYPES.filter((type) => !!permissions?.includes(PRICE_HISTORY_TYPE_MODULES[type]));

export const PRICE_CHANGE_SOURCES = [
  "teacher",
  "team_member",
  "admin_editor",
  "admin_impersonation",
  "system",
] as const;

export type PriceChangeSource = (typeof PRICE_CHANGE_SOURCES)[number];

export const PRICE_CHANGE_SOURCE_LABELS: Record<PriceChangeSource, string> = {
  teacher: "Teacher dashboard",
  team_member: "Teacher's team member",
  admin_editor: "Admin editor",
  admin_impersonation: "Admin signed in as teacher",
  system: "System or direct update",
};

export const PRICE_MOVEMENTS = ["increase", "decrease", "free_to_paid", "paid_to_free", "list_only"] as const;

export type PriceMovement = (typeof PRICE_MOVEMENTS)[number];

export const PRICE_MOVEMENT_LABELS: Record<PriceMovement, string> = {
  increase: "Increase",
  decrease: "Decrease",
  free_to_paid: "Free to paid",
  paid_to_free: "Paid to free",
  list_only: "List price only",
};

/* free_to_paid and paid_to_free are also increases and decreases; they win as the label. */
export function priceMovement(previous: number, next: number): PriceMovement {
  if (previous === 0 && next > 0) return "free_to_paid";
  if (previous > 0 && next === 0) return "paid_to_free";
  if (next > previous) return "increase";
  if (next < previous) return "decrease";
  return "list_only";
}

/* Percentage change of the selling price, one decimal; null from a free price. */
export function priceChangePercent(previous: number, next: number): number | null {
  if (!(previous > 0)) return null;
  return Math.round(((next - previous) / previous) * 1000) / 10;
}

const rupees = (amount: number): string =>
  `₹${Math.abs(amount).toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

/* A price as shown in the history: "Free" for 0, else rupees with paise only when there are any. */
export const formatHistoryPrice = (amount: number | null): string =>
  amount === null ? "-" : amount === 0 ? "Free" : rupees(amount);

/* A signed difference, "+₹50" or "-₹49.50". */
export const formatPriceDelta = (previous: number, next: number): string => {
  const delta = Math.round((next - previous) * 100) / 100;
  if (delta === 0) return "₹0";
  return `${delta > 0 ? "+" : "-"}${rupees(delta)}`;
};

export const formatPercent = (percent: number | null): string | null =>
  percent === null ? null : `${percent > 0 ? "+" : ""}${percent}%`;

const shortDateTime = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

const exactDateTime = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

/* "18 Nov 2026, 3:42 pm" in IST, whatever the admin's own time zone. */
export const formatChangedAt = (date: Date | string): string => shortDateTime.format(new Date(date));

/* The full timestamp for the detail view, to the second. */
export const formatChangedAtExact = (date: Date | string): string => `${exactDateTime.format(new Date(date))} IST`;