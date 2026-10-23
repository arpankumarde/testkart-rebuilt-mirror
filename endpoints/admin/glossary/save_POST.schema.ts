import { z } from "zod";
import superjson from "superjson";
import { GLOSSARY_CATEGORY_VALUES, GLOSSARY_STATUS_VALUES } from "../../../helpers/glossaryMeta";
import type { GlossaryTermDetail } from "./get_GET.schema";

/** Shared by the editor form and the save endpoint; publish rules live in helpers/glossaryValidation. */
export const schema = z.object({
  id: z.number().int().positive().optional(),
  term: z.string().max(120),
  slug: z.string().max(160),
  category: z.enum(GLOSSARY_CATEGORY_VALUES).nullable(),
  definition: z.string().max(300),
  explanationHeading: z.string().max(200),
  explanationFirst: z.string().max(20000),
  explanationSecond: z.string().max(20000),
  extraHeading: z.string().max(200),
  extraBody: z.string().max(20000),
  productText: z.string().max(400),
  productUrl: z.string().max(300),
  productLabel: z.string().max(120),
  relatedTermIds: z.array(z.number().int().positive()).max(3),
  seoTitle: z.string().max(120),
  seoDescription: z.string().max(320),
  canonicalUrl: z.string().max(2000),
  status: z.enum(GLOSSARY_STATUS_VALUES),
});

export type InputType = z.infer<typeof schema>;

export type ValidationIssue = { path: string; message: string };

export type OutputType = {
  success: true;
  term: GlossaryTermDetail;
};

/** Thrown by the fetch wrapper when the server rejects the content, carrying field-level issues. */
export class GlossaryValidationError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = "GlossaryValidationError";
    this.issues = issues;
  }
}

export const postAdminGlossarySave = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/glossary/save`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; issues?: ValidationIssue[] }>(await result.text());
    if (errorObject.issues?.length) {
      throw new GlossaryValidationError(errorObject.error, errorObject.issues);
    }
    throw new Error(errorObject.error);
  }

  return superjson.parse<OutputType>(await result.text());
};