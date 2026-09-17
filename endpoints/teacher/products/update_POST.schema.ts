import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts } from "../../../helpers/schema";
import { DigitalProductFileItem } from "../../../helpers/digitalProductFileTypes";
import { fileEntrySchemaRef } from "./create_POST.schema";

// id is the digital_product_files row the entry came from. Sending it back
// lets the server update that row in place so students keep the same file id.
const updateFileEntrySchema = fileEntrySchemaRef.extend({
  id: z.number().int().positive().optional().nullable(),
});

export const schema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(3).max(255, "Title must be 255 characters or fewer.").optional(),
  description: z.string().min(10).optional(),
  shortDescription: z.string().max(255).optional().nullable(),
  price: z.number().min(0).optional(),
  thumbnailUrl: z.string().url().optional().nullable(),
  thumbnailFileId: z.string().optional().nullable(),
  pdfUrl: z.string().url().optional(),
  pdfFileId: z.string().optional().nullable(),
  previewPages: z.number().int().min(0).optional().nullable(),
  pageCount: z.number().int().min(0).optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  language: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  examName: z.string().optional().nullable(),
  files: z.array(updateFileEntrySchema).optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<DigitalProducts>, "price" | "rating" | "fileSizeBytes"> & {
  price: number;
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