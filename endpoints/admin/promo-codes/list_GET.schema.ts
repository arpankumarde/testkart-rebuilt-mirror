import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { PromoCodes } from "../../../helpers/schema";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type AdminPromoCodeRow = Selectable<PromoCodes> & {
  usedCount: number;
  planNames: string[] | null;
};

export type OutputType = AdminPromoCodeRow[];

export const getAdminPromoCodes = async (
  body?: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/promo-codes/list`, {
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
