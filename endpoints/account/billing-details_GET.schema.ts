import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type BillingDetails = {
  name: string;
  email: string;
  phone: string;
  address: string;
  gstin: string | null;
};

export type OutputType = {
  billingDetails: BillingDetails | null;
};

export const getBillingDetails = async (
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/account/billing-details`, {
    method: "GET",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};
