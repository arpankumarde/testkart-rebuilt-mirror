import { z } from "zod";
import superjson from "superjson";
import type { InputType as SaveInput } from "../admin/current-affairs/save_POST.schema";
import type { CurrentAffairsStatus } from "../../helpers/schema";

export const schema = z.object({ slug: z.string().min(1).max(255) });

export type InputType = z.infer<typeof schema>;

/** A published digest in the shape the article renderer takes, without admin-only fields. */
export type PublicDigestDetail = Omit<SaveInput, "status"> & {
  status: CurrentAffairsStatus;
  id: number;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
  related: { id: number; title: string; slug: string }[];
};

export type OutputType = { post: PublicDigestDetail };

export const getCurrentAffairsDetails = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/current-affairs/details?slug=${encodeURIComponent(input.slug)}`, {
    method: "GET",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(await result.text());
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};