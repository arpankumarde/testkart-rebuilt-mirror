import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  paymentMode: "normal" | "recurring";
  walletBalance: number;
  // True when introOfferPlanIds is not empty.
  introOfferEligible: boolean;
  // Plans this teacher's autopay sign-up is charged introOfferPrice for in the
  // first cycle; empty outside recurring mode or once the teacher has had a paid plan.
  introOfferPlanIds: number[];
  introOfferPrice: number;
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