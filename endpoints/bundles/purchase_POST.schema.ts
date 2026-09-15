import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  bundleId: z.number().int().positive(),
  promoCode: z.string().optional(), // Note: promo code logic is not implemented in this version
});

export type InputType = z.infer<typeof schema>;

type PayUForm = {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
  payuUrl: string;
};

export type OutputType = {
  success: true;
  isFree: boolean;
  paymentData?: PayUForm;
};

export const postBundlesPurchase = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/bundles/purchase`, {
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