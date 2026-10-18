import { z } from "zod";
import superjson from "superjson";
import type { InputType as SaveInput } from "../admin/current-affairs/save_POST.schema";
import type { CurrentAffairsStatus } from "../../helpers/schema";

/** A digest by its period URL (type + period, e.g. weekly + 2026-w43), or an older post by its slug. */
export const schema = z
  .object({
    slug: z.string().min(1).max(255).optional(),
    type: z.enum(["daily", "weekly", "monthly"]).optional(),
    period: z.string().min(1).max(20).optional(),
  })
  .refine((input) => !!input.slug || (!!input.type && !!input.period), { message: "Pass a slug, or a type and period" });

export type InputType = z.infer<typeof schema>;

/** A published digest in the shape the article renderer takes, without admin-only fields. */
export type PublicDigestDetail = Omit<SaveInput, "status"> & {
  status: CurrentAffairsStatus;
  id: number;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
  related: { id: number; title: string; slug: string; path: string }[];
};

export type OutputType = {
  post: PublicDigestDetail;
  /** Where the post lives now; pages redirect here when the requested URL is an older one. */
  canonicalPath: string;
};

export const getCurrentAffairsDetails = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value) params.set(key, value);
  }
  const result = await fetch(`/_api/current-affairs/details?${params.toString()}`, {
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