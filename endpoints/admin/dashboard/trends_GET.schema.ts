import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  period: z.enum(["daily", "weekly", "monthly"])
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  userGrowth: Array<{ period: string; teachers: number; students: number; total: number }>;
  revenueTrend: Array<{ period: string; revenue: number; orders: number }>;
};

export const getAdminDashboardTrends = async (
  query: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const params = new URLSearchParams({ period: query.period });
  const result = await fetch(`/_api/admin/dashboard/trends?${params.toString()}`, {
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