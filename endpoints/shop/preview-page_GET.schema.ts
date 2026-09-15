import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({
  productId: z.number().int().positive(),
  // A specific file of a multi-file study notes product; the product's main file when omitted.
  fileId: z.number().int().positive().optional(),
  page: z.number().int().positive(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  page: number;
  // The product's preview page count, capped at the file's real page count.
  totalPages: number;
  imageUrl: string;
  width: number;
  height: number;
};

export const getShopPreviewPage = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const query = new URLSearchParams({
    productId: String(params.productId),
    page: String(params.page),
  });
  if (params.fileId) {
    query.set("fileId", String(params.fileId));
  }
  const result = await fetch(`/_api/shop/preview-page?${query.toString()}`, {
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