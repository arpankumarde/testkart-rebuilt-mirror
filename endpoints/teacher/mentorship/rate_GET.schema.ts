import superjson from "superjson";
import type { LivePrices } from "../../../helpers/livePricing";

export type OutputType = {
  enabled: boolean;
  /** The 25-minute class price (kept for older callers; same as prices.class25). */
  ratePerUnit: number | null;
  rateUnitMinutes: number;
  minRatePerUnit: number;
  durations: number[];
  /** Trial and class prices for 25 and 50 minutes. Null until a class price is set. */
  prices: LivePrices | null;
  minClassPrice25: number;
  minClassPrice50: number;
};

export const getTeacherMentorshipRate = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/mentorship/rate`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
