import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  productId: z.number().int().positive(),
  // Optional: preview a specific file within a multi-file product (e.g. a
  // study notes product with several chapter PDFs) instead of the
  // product's main file. Falls back to the main pdfUrl when omitted.
  fileId: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  previewUrl: string | null;
};

export const getShopPreviewUrl = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams({ productId: String(params.productId) });
  if (params.fileId) {
    query.set("fileId", String(params.fileId));
  }
  const result = await fetch(`/_api/shop/preview-url?${query.toString()}`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
    const errorObject = superjson.parse<{ error: string }>(
      await result.text()
    );
    throw new Error(errorObject.error);
  }
  return superjson.parse<OutputType>(await result.text());
};