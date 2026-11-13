import superjson from "superjson";
import type { LivePrices } from "../../../helpers/livePricing";

export type OutputType = {
  enabled: boolean;
  durations: number[];
  /** Short and full session class prices and the trial prices they give. Null until both are set. */
  prices: LivePrices | null;
  /** Whether the trial is discounted (off: the trial costs the class price). */
  trialDiscount: boolean;
  minClassPriceShort: number;
  minClassPriceFull: number;
  trialDiscountPercentShort: number;
  trialDiscountPercentFull: number;
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
