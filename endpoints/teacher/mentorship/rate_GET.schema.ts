import superjson from "superjson";
import type { LivePrices } from "../../../helpers/livePricing";

export type OutputType = {
  enabled: boolean;
  durations: number[];
  /** Class prices for 30 and 60 minutes and the trial prices they give. Null until both are set. */
  prices: LivePrices | null;
  /** Whether the trial is discounted (off: the trial costs the class price). */
  trialDiscount: boolean;
  minClassPrice30: number;
  minClassPrice60: number;
  trialDiscountPercent30: number;
  trialDiscountPercent60: number;
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
