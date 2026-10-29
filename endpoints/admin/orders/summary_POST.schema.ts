import { z } from "zod";
import superjson from "superjson";
import { adminOrderFiltersSchema } from "../../../helpers/adminOrderFilters";

export const ORDER_BREAKDOWNS = ["platform", "os", "browser", "brand", "paymentMode", "teacher", "product"] as const;
export type OrderBreakdown = (typeof ORDER_BREAKDOWNS)[number];

export const schema = z.object({
  filters: adminOrderFiltersSchema,
  breakdown: z.enum(ORDER_BREAKDOWNS).default("platform"),
});

export type InputType = z.input<typeof schema>;

export type BreakdownRow = {
  /** Raw value: a platform key, OS name, teacher id as text, and so on. null when not captured. */
  key: string | null;
  label: string;
  orders: number;
  completed: number;
  revenue: number;
};

export type OutputType = {
  totals: {
    orders: number;
    completed: number;
    revenue: number;
    pending: number;
    failed: number;
    cancelled: number;
    refunded: number;
    refundedAmount: number;
    /** Orders in the set that have source attribution at all (captured since 05-11-2026). */
    attributed: number;
  };
  breakdown: OrderBreakdown;
  rows: BreakdownRow[];
};

export const postAdminOrdersSummary = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/orders/summary`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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
