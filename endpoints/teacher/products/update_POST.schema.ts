import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts } from "../../../helpers/schema";
import { DigitalProductFileItem } from "../../../helpers/digitalProductFileTypes";
import { fileEntrySchemaRef } from "./create_POST.schema";
import { MAX_ITEM_LANGUAGES, MAX_LANGUAGE_LENGTH } from "../../../helpers/itemLanguages";
import { noEmoji } from "../../../helpers/emojiText";

// id is the digital_product_files row the entry came from. Sending it back
// lets the server update that row in place so students keep the same file id.
const updateFileEntrySchema = fileEntrySchemaRef.extend({
  id: z.number().int().positive().optional().nullable(),
});

export const schema = z.object({
  id: z.number().int().positive(),
  title: noEmoji(z.string().min(3).max(255, "Title must be 255 characters or fewer.")).optional(),
  description: z.string().min(10).optional(),
  shortDescription: z.string().max(255).optional().nullable(),
  price: z.number().min(0).optional(),
  // Omitted keeps the stored discount; null clears it. Must sit between 0 and price.
  discountPrice: z.number().min(0, "Discounted price cannot be negative.").optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  thumbnailFileId: z.string().optional().nullable(),
  pdfUrl: z.string().url().optional(),
  pdfFileId: z.string().optional().nullable(),
  /** Legacy product-wide preview count, applied to every file when no file sends its own setting. */
  previewPages: z.number().int().min(0).optional().nullable(),
  pageCount: z.number().int().min(0).optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  /** Omitted leaves the stored setting unchanged. */
  allowDownload: z.boolean().optional(),
  language: z.string().optional().nullable(),
  /** Takes precedence over language; an empty list clears it. The legacy column stores the list's summary. */
  languages: z
    .array(z.string().trim().min(1).max(MAX_LANGUAGE_LENGTH))
    .max(MAX_ITEM_LANGUAGES, `Pick up to ${MAX_ITEM_LANGUAGES} languages.`)
    .optional(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  examName: z.string().optional().nullable(),
  examNames: z
    .array(z.string().trim().min(1))
    .max(5)
    .optional()
    .describe("Official exam names, up to 5, first is the primary"),
  files: z.array(updateFileEntrySchema).optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<DigitalProducts>, "price" | "discountPrice" | "rating" | "fileSizeBytes"> & {
  price: number;
  discountPrice: number | null;
  rating: number | null;
  fileSizeBytes: number | null;
  files: DigitalProductFileItem[];
};

export const postTeacherProductsUpdate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/products/update`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string; details?: string }>(
      await result.text()
    );
    throw new Error(errorObject.details || errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};