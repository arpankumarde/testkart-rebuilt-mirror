import { z } from "zod";
import superjson from "superjson";
import { Selectable } from "kysely";
import { DigitalProducts } from "../../helpers/schema";

export const schema = z.object({
  category: z.string().optional(),
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  language: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "popular", "price_asc", "price_desc"]).default("newest"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  examId: z.number().int().positive().optional(),
});

export type InputType = z.infer<typeof schema>;

export type ShopProductListItem = Pick<
  Selectable<DigitalProducts>,
  "id" | "title" | "slug" | "thumbnailUrl" | "category" | "publishedAt" | "pageCount"
> & {
  fileCount: number;
  price: number;
  rating: number | null;
  ratingsCount: number;
  examName: string | null;
  totalPurchases: number;
  teacherName: string;
  teacherSlug: string;
  teacherAvatar: string | null;
  teacherIsVerified: boolean;
  views: number;
  teacherTagline: string | null;
  teacherYearsOfExperience: number | null;
};

export type OutputType = {
  products: ShopProductListItem[];
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

export const getShopProductsList = async (
  params: InputType,
  init?: RequestInit
): Promise<OutputType> => {
  const queryParams = new URLSearchParams();
  if (params.category) queryParams.set("category", params.category);
  if (params.priceMin !== undefined) queryParams.set("priceMin", params.priceMin.toString());
  if (params.priceMax !== undefined) queryParams.set("priceMax", params.priceMax.toString());
  if (params.language) queryParams.set("language", params.language);
  if (params.search) queryParams.set("search", params.search);
  if (params.examId !== undefined) queryParams.set("examId", params.examId.toString());
  queryParams.set("sort", params.sort);
  queryParams.set("page", params.page.toString());
  queryParams.set("limit", params.limit.toString());

  const result = await fetch(`/_api/shop/list?${queryParams.toString()}`, {
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