import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  paymentMode: "normal" | "recurring";
  walletBalance: number;
  // True if this teacher has never had a paid plan, so Starter/Individual
  // monthly autopay sign-up still qualifies for the ₹1 first-cycle intro offer.
  introOfferEligible: boolean;
};

export const getTeacherSubscriptionPaymentInfo = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/teacher/subscription/payment-info`, {
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