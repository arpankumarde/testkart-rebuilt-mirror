import { z } from "zod";
import superjson from "superjson";
import type { GlossaryCategory, GlossaryTermStatus } from "../../../helpers/schema";
import type { InputType as SaveInput } from "./save_POST.schema";

export const schema = z.object({
  id: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

/** A related term as the admin sees it. Its name and definition are read from the term itself. */
export type GlossaryRelatedTerm = {
  id: number;
  term: string;
  slug: string;
  category: GlossaryCategory;
  definition: string;
  status: GlossaryTermStatus;
};

/** The editable term in the editor's own shape, plus the read-only record fields. */
export type GlossaryTermDetail = Omit<SaveInput, "id" | "category"> & {
  id: number;
  category: GlossaryCategory;
  relatedTerms: GlossaryRelatedTerm[];
  /** How many other terms list this one as related. */
  usedByCount: number;
  previousSlugs: string[];
  publishedAt: Date | null;
  firstPublishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string | null;
  updatedByName: string | null;
};

export type OutputType = { term: GlossaryTermDetail };

export const getAdminGlossaryTerm = async (input: InputType, init?: RequestInit): Promise<OutputType> => {
  const params = new URLSearchParams({ id: String(input.id) });
  const result = await fetch(`/_api/admin/glossary/get?${params.toString()}`, {
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