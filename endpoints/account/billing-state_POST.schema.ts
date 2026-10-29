import { z } from "zod";
import superjson from "superjson";
import { BillingDetails } from "./billing-details_GET.schema";
import { INDIAN_STATES } from "../../helpers/indianLocationsData";

export const schema = z
  .object({
    state: z.enum(INDIAN_STATES, { errorMap: () => ({ message: "Please select your state." }) }),
  })
  .strict();

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  billingDetails: BillingDetails;
};

export const postBillingState = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/account/billing-state`, {
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