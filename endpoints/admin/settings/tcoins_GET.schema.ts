import { z } from "zod";
import superjson from "superjson";
import type { TcoinsConfig } from "../../../helpers/tcoinsMath";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = TcoinsConfig & {
  /** Coins students hold right now and coins still waiting on a pending order. */
  outstandingCoins: number;
  studentsWithCoins: number;
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