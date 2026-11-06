import { z } from "zod";
import superjson from "superjson";
import type { TcoinsConfig } from "../../../helpers/tcoinsMath";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = TcoinsConfig & {
  /** Unexpired coins students hold right now. */
  outstandingCoins: number;
  studentsWithCoins: number;
  /** Coins that expired unspent, all time. */
  expiredCoins: number;
  /** Held coins that expire in the next 7 days. */
  expiringSoonCoins: number;
};

export const getAdminTcoinsSettings = async (
  params: InputType = {},
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/settings/tcoins`, {
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