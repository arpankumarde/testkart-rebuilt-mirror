import superjson from "superjson";
import type { GlossaryCategory } from "../../helpers/schema";

/** One term on the hub or a related-term card. The definition is the term's own, never a copy. */
export type PublicGlossaryCard = {
  term: string;
  slug: string;
  category: GlossaryCategory;
  definition: string;
};

export type OutputType = { terms: PublicGlossaryCard[] };

export const getGlossaryList = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/glossary/list`, {
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