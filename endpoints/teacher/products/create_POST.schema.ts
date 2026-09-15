import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts } from "../../../helpers/schema";
import { DigitalProductFileItem } from "../../../helpers/digitalProductFileTypes";

const fileEntrySchema = z.object({
  title: z.string().min(1, "File title is required."),
  fileUrl: z.string().url("Must be a valid URL."),
  fileId: z.string().optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  pageCount: z.number().int().min(0).optional().nullable(),
});

export const fileEntrySchemaRef = fileEntrySchema;

export const schema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  description: z.string().min(10, "Description must be at least 10 characters long."),
  shortDescription: z.string().max(255).optional().nullable(),
  price: z.number().min(0, "Price cannot be negative."),
  thumbnailUrl: z.string().url("Must be a valid URL.").optional().nullable(),
  thumbnailFileId: z.string().optional().nullable(),
  pdfUrl: z.string().url("Must be a valid URL.").optional(),
  pdfFileId: z.string().optional().nullable(),
  previewPages: z.number().int().min(0).optional().nullable(),
  pageCount: z.number().int().min(0).optional().nullable(),
  fileSizeBytes: z.number().int().min(0).optional().nullable(),
  language: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  examName: z.string().optional().nullable(),
  files: z.array(fileEntrySchema).optional().nullable(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Omit<Selectable<DigitalProducts>, "price" | "rating" | "fileSizeBytes"> & {
  price: number;
  rating: number | null;
  fileSizeBytes: number | null;
  files: DigitalProductFileItem[];
};

export const postTeacherProductsCreate = async (
  body: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/teacher/products/create`, {
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