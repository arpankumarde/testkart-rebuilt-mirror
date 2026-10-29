import { z } from "zod";
import { OrderStatusArrayValues } from "./schema";
import {
  ORDER_DEVICE_TYPES,
  ORDER_GATEWAYS,
  ORDER_PAYMENT_MODES,
  ORDER_PLATFORMS,
} from "./orderAttribution";

/**
 * The filters the admin Transactions page sends to the admin/orders search,
 * summary and export endpoints. Every endpoint applies the same set through
 * helpers/adminOrderQuery, so the table, the figures above it and the CSV
 * always describe the same orders. Lists combine with OR inside one filter and
 * AND across filters.
 */

/** Stands for "no value captured" inside the OS, browser, brand and method lists. */
export const NOT_CAPTURED = "__none";

export const ORDER_PRODUCT_TYPES = ["course", "test", "live_test", "notes", "bundle", "mentorship"] as const;
export type OrderProductType = (typeof ORDER_PRODUCT_TYPES)[number];

export const ORDER_PRODUCT_TYPE_LABELS: Record<OrderProductType, string> = {
  course: "Course",
  test: "Mock test series",
  live_test: "Live test",
  notes: "Study notes",
  bundle: "Bundle",
  mentorship: "Mentorship",
};

const facetList = z.array(z.string().trim().min(1).max(64)).max(30);

export const adminOrderFiltersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  statuses: z.array(z.enum(OrderStatusArrayValues)).max(5).optional(),
  /** Pending and created more than an hour ago, the dashboard's stuck-orders tile. */
  stalePending: z.boolean().optional(),
  createdFrom: z.date().optional(),
  createdTo: z.date().optional(),
  paidFrom: z.date().optional(),
  paidTo: z.date().optional(),
  platforms: z.array(z.enum(ORDER_PLATFORMS)).max(ORDER_PLATFORMS.length).optional(),
  osNames: facetList.optional(),
  browsers: facetList.optional(),
  deviceTypes: z.array(z.enum(ORDER_DEVICE_TYPES)).max(ORDER_DEVICE_TYPES.length).optional(),
  brands: facetList.optional(),
  paymentMethods: facetList.optional(),
  paymentModes: z.array(z.enum(ORDER_PAYMENT_MODES)).max(ORDER_PAYMENT_MODES.length).optional(),
  gateways: z.array(z.enum(ORDER_GATEWAYS)).max(ORDER_GATEWAYS.length).optional(),
  productTypes: z.array(z.enum(ORDER_PRODUCT_TYPES)).max(ORDER_PRODUCT_TYPES.length).optional(),
  teacherIds: z.array(z.number().int().positive()).max(50).optional(),
  promoCodes: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  discount: z.enum(["with", "without"]).optional(),
  amountMin: z.number().min(0).max(10_000_000).optional(),
  amountMax: z.number().min(0).max(10_000_000).optional(),
});

export type AdminOrderFilters = z.infer<typeof adminOrderFiltersSchema>;

export const ORDER_SORT_COLUMNS = ["id", "date", "paidAt", "student", "amount", "status"] as const;
export type OrderSortColumn = (typeof ORDER_SORT_COLUMNS)[number];

export const adminOrderSortSchema = z.object({
  column: z.enum(ORDER_SORT_COLUMNS).default("date"),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminOrderSort = z.infer<typeof adminOrderSortSchema>;
