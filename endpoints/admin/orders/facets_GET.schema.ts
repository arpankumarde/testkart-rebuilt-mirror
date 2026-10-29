import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type FacetOption = {
  /** null means the value was never captured. */
  value: string | null;
  count: number;
};

export type OutputType = {
  osNames: FacetOption[];
  browsers: FacetOption[];
  brands: FacetOption[];
  paymentMethods: FacetOption[];
  teachers: { id: number; name: string; count: number }[];
  promoCodes: { code: string; count: number }[];
};

export const getAdminOrdersFacets = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/admin/orders/facets`, {
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