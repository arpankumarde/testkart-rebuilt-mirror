import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  enabled: z.boolean(),
  redeemPercent: z.number().min(0).max(100),
  cashbackPercent: z.number().min(0).max(100),
  maxCashback: z.number().int().min(0).max(100000),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
};

export const postAdminTcoinsSettings = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/settings/tcoins`, {
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