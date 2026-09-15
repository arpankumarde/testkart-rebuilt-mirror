import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { PromoCodes } from "../../../helpers/schema";

export const schema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.enum(["active", "scheduled", "expired"]).optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  promoCodes: Selectable<PromoCodes>[];
  total: number;
};

export const getTeacherPromoCodesList = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  searchParams.append("page", String(params.page));
  searchParams.append("limit", String(params.limit));
  if (params.status) {
    searchParams.append("status", params.status);
  }

  const result = await fetch(`/_api/teacher/promo-codes/list?${searchParams.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: any }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};