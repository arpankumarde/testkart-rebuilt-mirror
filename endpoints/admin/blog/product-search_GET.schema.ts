import { z } from "zod";
import superjson from "superjson";

export const PRODUCT_EMBED_TYPES = ["mock_test", "digital_product", "course", "bundle"] as const;
export type ProductEmbedType = (typeof PRODUCT_EMBED_TYPES)[number];

export const schema = z.object({
  query: z.string().trim().optional(),
  type: z.enum(PRODUCT_EMBED_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type InputType = z.infer<typeof schema>;

export type ProductSearchItem = {
  type: ProductEmbedType;
  id: number;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  price: number;
  originalPrice: number | null;
  teacherName: string | null;
  isFree: boolean;
};

export type OutputType = {
  items: ProductSearchItem[];
};

export const getAdminBlogProductSearch = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set("query", params.query);
  if (params.type) searchParams.set("type", params.type);
  if (params.limit) searchParams.set("limit", String(params.limit));

  const result = await fetch(`/_api/admin/blog/product-search?${searchParams.toString()}`, {
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
