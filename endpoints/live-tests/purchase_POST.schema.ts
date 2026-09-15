import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  liveTestId: z.number().int().positive(),
  deepLinkUrl: z.string().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
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
  udf1?: string;
};

export const postLiveTestsPurchase = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/live-tests/purchase`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.details || errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};