import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  slug: z.string().min(1).max(255),
  excludeId: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = { slug: string; available: boolean; usedBy: { id: number; title: string } | null };

export const getAdminCurrentAffairsSlugCheck = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ slug: input.slug });
  if (input.excludeId) params.append("excludeId", String(input.excludeId));
  const result = await fetch(`/_api/admin/current-affairs/slug-check?${params.toString()}`, {
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