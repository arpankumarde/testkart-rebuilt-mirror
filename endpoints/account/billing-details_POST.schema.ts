import { z } from "zod";
import superjson from "superjson";
import { BillingDetails } from "./billing-details_GET.schema";

export const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters.").max(200),
    email: z
      .union([z.string().email("Invalid email address."), z.literal("")])
      .optional()
      .default(""),
    phone: z.string().max(30).optional().default(""),
    address: z.string().min(5, "Address must be at least 5 characters.").max(500),
    gstin: z
      .union([
        z
          .string()
          .regex(/^[0-9A-Z]{15}$/, "GSTIN must be 15 characters (numbers and uppercase letters)."),
        z.literal(""),
      ])
      .optional()
      .nullable(),
  })
  .strict();

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  billingDetails: BillingDetails;
};

export const postBillingDetails = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/account/billing-details`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
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
