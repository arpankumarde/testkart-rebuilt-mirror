import { z } from "zod";
import superjson from "superjson";
import type { GlossaryCategory } from "../../helpers/schema";
import type { PublicGlossaryCard } from "./list_GET.schema";

export const schema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(160),
});

export type InputType = z.infer<typeof schema>;

/** A published term without admin-only fields. Blank optional fields come back as null. */
export type PublicGlossaryTerm = {
  term: string;
  slug: string;
  category: GlossaryCategory;
  definition: string;
  explanationHeading: string | null;
  explanationFirst: string;
  explanationSecond: string;
  extraHeading: string | null;
  extraBody: string | null;
  productText: string | null;
  productUrl: string | null;
  productLabel: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
};

export type OutputType = {
  term: PublicGlossaryTerm;
  /** Where the term lives now; a request on an older slug redirects here. */
  canonicalPath: string;
  /** Published related terms only, so a card can never link to a page that is not live. */
  related: PublicGlossaryCard[];
};

export const getGlossaryDetails = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/glossary/details?${new URLSearchParams({ slug: input.slug }).toString()}`, {
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