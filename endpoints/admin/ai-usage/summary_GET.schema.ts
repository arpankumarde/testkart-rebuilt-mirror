import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  totalAttempts: number;
  doneCount: number;
  pendingCount: number;
  failedCount: number;
  successRate: number;
  activeTeachersCount: number;
  totalTeachersCount: number;
  adoptionRate: number;
  avgDurationMs: number | null;
  byFeature: { feature: string; totalAttempts: number; doneCount: number; failedCount: number }[];
  dailyTrend: { date: string; count: number }[];
};

export const getAdminAiUsageSummary = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, value instanceof Date ? value.toISOString() : String(value));
    }
  });

  const result = await fetch(`/_api/admin/ai-usage/summary?${searchParams.toString()}`, {
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
