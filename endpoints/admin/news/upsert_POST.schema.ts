import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { NewsCoverage } from "../../../helpers/schema";

export const schema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().min(1).max(255),
  /** Editable. Left blank, it is derived from the title. */
  slug: z.string().max(255).optional(),
  publicationName: z.string().max(255).nullable().optional(),
  imageUrl: z.string().min(1),
  imageFileId: z.string().nullable().optional(),
  excerpt: z.string().max(500).nullable().optional(),
  writeup: z.string().min(1),
  coverageUrl: z.string().url().nullable().optional(),
  /** Comma-separated. Normalised server-side before it is stored. */
  keywords: z.string().max(500).nullable().optional(),
  publishedAt: z.coerce.date(),
  isPublished: z.boolean().default(true),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: true;
  item: Selectable<NewsCoverage>;
};

export const postAdminNewsUpsert = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/admin/news/upsert`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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
